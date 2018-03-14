import * as clone               from 'clone';
import { DescField }            from './description';
import { DeepModelDescription } from './modelDescription';

export const kDeepModelPayloadRootSegment = '%root%';

export interface DeepModelFieldWithMetadata {
    segmentKey: string;
    key: string;
    field: DescField<any>;
}

export class DeepModelDefinition<TDesc extends DeepModelDescription = DeepModelDescription> {

    private _descriptions: Record<string, DeepModelDescription> = {};
    private _defaultVal: any[];
    private _activated = false;

    private _ident = '';

    get ident(): string {
        return this._ident;
    }

    private _fields: Readonly<DeepModelFieldWithMetadata>[];

    get fields(): Readonly<DeepModelFieldWithMetadata>[] {
        return this._fields.slice();
    }

    get moduleIdent(): string {
        return this._moduleIdent;
    }

    get subIdent(): string {
        return this._subIdent || this._moduleIdent;
    }

    get desc(): TDesc {
        return this._descriptions[kDeepModelPayloadRootSegment] as TDesc;
    }

    get label(): string {
        return this._label;
    }

    constructor(private _moduleIdent: string,
                private _subIdent: string,
                private _label: string,
                rootDesc: TDesc) {
        this._ident = this._moduleIdent;
        if (this._subIdent) {
            this._ident += '_' + this._subIdent;
        }
        this.addDesc(kDeepModelPayloadRootSegment, rootDesc);
    }

    getFieldIndex(field: DescField<any>): number {
        for (let i = 0; i < this._fields.length; i++) {
            if (this._fields[i].field === field) {
                return i;
            }
        }
        return -1;
    }

    public getDescSegment(segment: string): DeepModelDescription | undefined {
        return this._descriptions[segment];
    }

    public activate() {
        this._readDesc();
        this._activated = true;
    }

    public addDesc(payloadSegment: string, desc: DeepModelDescription) {
        this._descriptions[payloadSegment] = desc;
        if (this._activated) {
            this._readDesc();
        }
    }

    public getDefaultData(): any[] {
        return clone(this._defaultVal);
    }

    public documentToArr(document: any): any[] {
        const dataArr = this._defaultVal.slice();
        for (let i = 0; i < this._fields.length; i++) {
            const fieldMeta = this._fields[i];
            const documentSegment = document[fieldMeta.segmentKey];
            if (!documentSegment) {
                continue;
            }
            dataArr[i] = fieldMeta.field.convertFromDocument(documentSegment[fieldMeta.key]);
        }
        return dataArr;
    }

    public arrToDocument(arr: any[]): any {
        const document: any = {};
        this._fields.forEach((fieldMeta, index) => {
            const segment = fieldMeta.segmentKey;
            if (!document[segment]) {
                document[segment] = {};
            }
            document[segment][fieldMeta.key] = fieldMeta.field.convertToDocument(arr[index]);
        });
        return document;
    }

    private _readDesc() {
        this._fields = [];
        this._defaultVal = [];
        for (let segmentKey of Object.keys(this._descriptions)) {
            const desc = this._descriptions[segmentKey];
            for (const key of Object.keys(desc)) {
                const field = desc[key] as DescField<any>;
                this._fields.push(
                    {
                        segmentKey,
                        key,
                        field
                    });
                this._defaultVal.push(field.getDefaultVal());
            }
        }
    }
}