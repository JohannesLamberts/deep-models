import * as clone           from 'clone';
import { DescField }        from './description';
import { ModelDescription } from './modelDescription';

export const kModelPayloadRootSegment = '%root%';

export interface ModelFieldWithMetadata {
    segmentKey: string;
    key: string;
    field: DescField<any>;
}

export type ModelNameCb = (arg: any) => string;

export class ModelDefinition<TDesc extends ModelDescription = ModelDescription> {

    private _segments: Record<string, {
        description: ModelDescription;
        label: string;
    }> = {};

    private _defaultVal: any[] = [];
    private _activated = false;

    private _ident = '';

    get ident(): string {
        return this._ident;
    }

    private _fields: Readonly<ModelFieldWithMetadata>[] = [];

    get fields(): Readonly<ModelFieldWithMetadata>[] {
        return this._fields.slice();
    }

    get moduleIdent(): string {
        return this._moduleIdent;
    }

    get subIdent(): string {
        return this._subIdent || this._moduleIdent;
    }

    get rootDescription(): TDesc {
        return this._segments[kModelPayloadRootSegment].description as TDesc;
    }

    get label(): string {
        return this._segments[kModelPayloadRootSegment].label;
    }

    get nameFn(): ModelNameCb {
        return this._nameFn;
    }

    constructor(private _moduleIdent: string,
                private _subIdent: string,
                label: string,
                rootDesc: TDesc,
                private _nameFn: ModelNameCb = (() => '')) {
        this._ident = this._moduleIdent;
        if (this._subIdent) {
            this._ident += '_' + this._subIdent;
        }
        this.addDesc(kModelPayloadRootSegment,
                     label,
                     rootDesc);
    }

    getFieldIndex(field: DescField<any>): number {
        for (let i = 0; i < this._fields.length; i++) {
            if (this._fields[i].field === field) {
                return i;
            }
        }
        return -1;
    }

    public getDescSegment(segment: string): {
        description: ModelDescription;
        label: string;
    } {
        return this._segments[segment];
    }

    public addDesc(segmentKey: string,
                   label: string,
                   description: ModelDescription) {

        this._segments[segmentKey] = {
            label,
            description
        };

        for (const key of Object.keys(description)) {
            const field = description[key] as DescField<any>;
            this._fields.push(
                {
                    segmentKey,
                    key,
                    field
                });
            this._defaultVal.push(field.getDefaultVal());
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
}