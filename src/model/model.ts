import { ImmutableArray }         from 'typescript-immutable';
import { DeepModelDefinition }    from './definition/definition';
import { DescField }              from './definition/description';
import { DescFieldSubModelArray } from './definition/fieldSubModelArray';
import { DeepModelDescription }   from './definition/modelDescription';
import { DeepModelFPtr }          from './fPtr';
import { DeepModelFPtrSub }       from './fPtrSub';

export type DeepModelDataDbPayload = ImmutableArray<any>;

export enum EDeepModelImmutableMode {
    eOff,
    eOn,
    eCollecting
}

export interface DeepModelVersion {
    readonly u: string;  // user
    readonly t: Date;     // time
}

export interface DeepModelDataMeta {
    [key: string]: {};
}

export interface DeepModelData {
    readonly _id: string;
    readonly versions: DeepModelVersion[];
    payload: DeepModelDataDbPayload;
    readonly meta: DeepModelDataMeta;
}

export type DeepModelDataJSON = Readonly<{
    _id: string;
    versions: DeepModelVersion[];
    payload: any[];
    meta: DeepModelDataMeta;
}>;

export class DeepModel<TModelDef extends DeepModelDefinition = DeepModelDefinition> {

    private _immutableMode: EDeepModelImmutableMode = EDeepModelImmutableMode.eOff;
    private _immutableOnChange?: ((model: DeepModel<TModelDef>) => void);
    private _onMultipleChangeCollector?: DeepModel<TModelDef>;

    get modelDefinition(): TModelDef {
        return this._modelDef;
    }

    get id(): string {
        return this._data._id;
    }

    get name() {
        return '';
    }

    get versions(): DeepModelVersion[] {
        return this._data.versions;
    }

    get payload(): ImmutableArray<any> {
        return this._data.payload;
    }

    get dataForTransfer(): DeepModelDataJSON {
        return {
            _id: this._data._id,
            versions: this._data.versions,
            meta: this._data.meta,
            payload: this._data.payload.slice()
        };
    }

    public static initialFor<TModelDef extends DeepModelDefinition>(modelDef: TModelDef): DeepModel<TModelDef> {
        return DeepModel.fromDataArray<TModelDef>(modelDef.getDefaultData(), modelDef);
    }

    public static fromTransferData<TModelDef extends DeepModelDefinition>(data: DeepModelDataJSON,
                                                                          modelDef: TModelDef): DeepModel<TModelDef> {
        return new DeepModel<TModelDef>(
            modelDef, {
                _id: data._id,
                versions: data.versions,
                meta: data.meta,
                payload: new ImmutableArray(data.payload)
            });
    }

    public static fromDataArray<TModelDef extends DeepModelDefinition>(payload: any[],
                                                                       modelDef: TModelDef): DeepModel<TModelDef> {
        return new DeepModel<TModelDef>
        (modelDef,
         {
             _id: payload[0],
             versions: [],
             meta: {},
             payload: new ImmutableArray(payload)
         });
    }

    public static getStructuredPayloadCopy(model: DeepModel) {
        return model.modelDefinition.arrToDocument(model.payload.slice());
    }

    protected constructor(private _modelDef: TModelDef,
                          protected _data: DeepModelData) {
    }

    public getMetadata(key: string): Object | undefined {
        return this._data.meta[key];
    }

    public immutable(cb: ((model: DeepModel<TModelDef>) => void)) {
        this._immutableMode = EDeepModelImmutableMode.eOn;
        this._immutableOnChange = (model: DeepModel<TModelDef>) => {
            this._immutableOnChange = () => {
                throw new Error(`Can't run consecutive updates on immutable`);
            };
            cb(model);
        };
    }

    public getIdIncModule(): string {
        return `${this.id}@${this._modelDef.ident}`;
    }

    public getClone(dataFrom?: DeepModel<TModelDef>): DeepModel<TModelDef> {

        const dataSource = dataFrom
            ? dataFrom._data
            : this._data;

        return new DeepModel(
            this._modelDef,
            {
                _id: dataSource._id,
                versions: dataSource.versions,
                meta: dataSource.meta,
                payload: dataSource.payload.push() // copies, no clone() function provided
            });
    }

    public mutationScope(cb: () => void) {
        switch (this._immutableMode) {
            case EDeepModelImmutableMode.eOff:
                throw new Error(`Set immutable before calling mutationScope()`);
            case EDeepModelImmutableMode.eCollecting:
                throw new Error(`ENoNestedExecution of mutationScope()`);
            case EDeepModelImmutableMode.eOn:

                this._immutableMode = EDeepModelImmutableMode.eCollecting;
                this._onMultipleChangeCollector = this.getClone();
                cb();
                this._immutableMode = EDeepModelImmutableMode.eOn;
                this._immutableOnChange!(this._onMultipleChangeCollector);
                delete this._onMultipleChangeCollector;

                break;
            default:
                throw new Error(`ECaseNotImplemented: ${this._immutableMode}`);
        }
    }

    public updatePayload(index: number, value: {}) {
        switch (this._immutableMode) {
            case EDeepModelImmutableMode.eOff:
                this._updatePayload(index, value);
                break;
            case EDeepModelImmutableMode.eOn:

                const nextModel = this.getClone();
                nextModel._updatePayload(index, value);
                this._immutableOnChange!(nextModel);

                break;
            case EDeepModelImmutableMode.eCollecting:

                if (!this._onMultipleChangeCollector) {
                    throw new Error(`EChangeCollectorUndefined`);
                }
                this._onMultipleChangeCollector._updatePayload(index, value);

                break;
            default:
                throw new Error(`ECaseNotImplemented: ${this._immutableMode}`);
        }
    }

    public fPtr<TVal>(field: DescField<TVal>): DeepModelFPtr<TVal> {
        return new DeepModelFPtr<TVal>(this, field);
    }

    public fPtrSubModel<TDesc extends DeepModelDescription = DeepModelDescription>
    (field: DescFieldSubModelArray<TDesc>): DeepModelFPtrSub<TDesc> {
        return new DeepModelFPtrSub<TDesc>(this, field);
    }

    public subModelFor<TDesc extends DeepModelDescription = DeepModelDescription,
        TDef extends DeepModelDefinition<TDesc> = DeepModelDefinition<TDesc>>
    (val: any[],
     subModelIndex: number,
     field: DescFieldSubModelArray<any>): DeepModel<TDef> {

        const model = DeepModel.fromDataArray<TDef>(val, field.subDefinition as {} as TDef);
        if (this._immutableMode !== EDeepModelImmutableMode.eOff) {
            model.immutable((nextSubModel: DeepModel<any>) => {
                const fieldPayload = this.fPtrSubModel(field).get().slice();
                fieldPayload[subModelIndex] = nextSubModel.payload;
                this.fPtr(field).set(fieldPayload);
            });
        }
        return model;
    }

    private _updatePayload(index: number, value: {}) {
        this._data.payload = this._data.payload.set(index, value);
    }
}
