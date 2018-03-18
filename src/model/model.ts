import { ImmutableArray }         from 'typescript-immutable';
import { ModelDefinition }        from './definition/definition';
import { DescField }              from './definition/description';
import { DescFieldSubModelArray } from './definition/fieldSubModelArray';
import { ModelDescription }       from './definition/modelDescription';
import { ModelFPtr }              from './fPtr';
import { ModelFPtrSub }           from './fPtrSub';

export type ModelDataDbPayload = ImmutableArray<any>;

export enum EModelImmutableMode {
    eOff,
    eOn,
    eCollecting
}

export interface ModelVersion {
    readonly u: string;  // user
    readonly t: Date;     // time
}

export interface ModelDataMeta {
    [key: string]: {};
}

export interface ModelData {
    readonly _id: string;
    readonly versions: ModelVersion[];
    payload: ModelDataDbPayload;
    readonly meta: ModelDataMeta;
}

export type ModelDataJSON = Readonly<{
    _id: string;
    versions: ModelVersion[];
    payload: any[];
    meta: ModelDataMeta;
}>;

export class Model<TModelDef extends ModelDefinition = ModelDefinition> {

    private _immutableMode: EModelImmutableMode = EModelImmutableMode.eOff;
    private _immutableOnChange?: ((model: Model<TModelDef>) => void);
    private _onMultipleChangeCollector?: Model<TModelDef>;

    get modelDefinition(): TModelDef {
        return this._modelDef;
    }

    get id(): string {
        return this._data._id;
    }

    get name(): string {
        return this.modelDefinition.nameFn(this);
    }

    get versions(): ModelVersion[] {
        return this._data.versions;
    }

    get payload(): ImmutableArray<any> {
        return this._data.payload;
    }

    get dataForTransfer(): ModelDataJSON {
        return {
            _id: this._data._id,
            versions: this._data.versions,
            meta: this._data.meta,
            payload: this._data.payload.slice()
        };
    }

    public static initialFor<TModelDef extends ModelDefinition>(modelDef: TModelDef): Model<TModelDef> {
        return Model.fromDataArray<TModelDef>(modelDef.getDefaultData(), modelDef);
    }

    public static fromTransferData<TModelDef extends ModelDefinition>(data: ModelDataJSON,
                                                                      modelDef: TModelDef): Model<TModelDef> {
        return new Model<TModelDef>(
            modelDef, {
                _id: data._id,
                versions: data.versions,
                meta: data.meta,
                payload: new ImmutableArray(data.payload)
            });
    }

    public static fromDataArray<TModelDef extends ModelDefinition>(payload: any[],
                                                                   modelDef: TModelDef): Model<TModelDef> {
        return new Model<TModelDef>
        (modelDef,
         {
             _id: payload[0],
             versions: [],
             meta: {},
             payload: new ImmutableArray(payload)
         });
    }

    public static getStructuredPayloadCopy(model: Model) {
        return model.modelDefinition.arrToDocument(model.payload.slice());
    }

    protected constructor(private _modelDef: TModelDef,
                          protected _data: ModelData) {
    }

    public getMetadata(key: string): Object | undefined {
        return this._data.meta[key];
    }

    public immutable(cb: ((model: Model<TModelDef>) => void)) {
        this._immutableMode = EModelImmutableMode.eOn;
        this._immutableOnChange = (model: Model<TModelDef>) => {
            this._immutableOnChange = () => {
                throw new Error(`Can't run consecutive updates on immutable`);
            };
            cb(model);
        };
    }

    public getIdIncModule(): string {
        return `${this.id}@${this._modelDef.ident}`;
    }

    public getClone(dataFrom?: Model<TModelDef>): Model<TModelDef> {

        const dataSource = dataFrom
            ? dataFrom._data
            : this._data;

        return new Model(
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
            case EModelImmutableMode.eOff:
                throw new Error(`Set immutable before calling mutationScope()`);
            case EModelImmutableMode.eCollecting:
                throw new Error(`ENoNestedExecution of mutationScope()`);
            case EModelImmutableMode.eOn:

                this._immutableMode = EModelImmutableMode.eCollecting;
                this._onMultipleChangeCollector = this.getClone();
                cb();
                this._immutableMode = EModelImmutableMode.eOn;
                this._immutableOnChange!(this._onMultipleChangeCollector);
                delete this._onMultipleChangeCollector;

                break;
            default:
                throw new Error(`ECaseNotImplemented: ${this._immutableMode}`);
        }
    }

    public updatePayload(index: number, value: {}) {
        switch (this._immutableMode) {
            case EModelImmutableMode.eOff:
                this._updatePayload(index, value);
                break;
            case EModelImmutableMode.eOn:

                const nextModel = this.getClone();
                nextModel._updatePayload(index, value);
                this._immutableOnChange!(nextModel);

                break;
            case EModelImmutableMode.eCollecting:

                if (!this._onMultipleChangeCollector) {
                    throw new Error(`EChangeCollectorUndefined`);
                }
                this._onMultipleChangeCollector._updatePayload(index, value);

                break;
            default:
                throw new Error(`ECaseNotImplemented: ${this._immutableMode}`);
        }
    }

    public fPtr<TVal>(field: DescField<TVal>): ModelFPtr<TVal> {
        return new ModelFPtr<TVal>(this, field);
    }

    public fPtrSubModel<TDesc extends ModelDescription = ModelDescription>
    (field: DescFieldSubModelArray<TDesc>): ModelFPtrSub<TDesc> {
        return new ModelFPtrSub<TDesc>(this, field);
    }

    public subModelFor<TDesc extends ModelDescription = ModelDescription,
        TDef extends ModelDefinition<TDesc> = ModelDefinition<TDesc>>
    (val: any[],
     subModelIndex: number,
     field: DescFieldSubModelArray<any>): Model<TDef> {

        const model = Model.fromDataArray<TDef>(val, field.subDefinition as {} as TDef);
        if (this._immutableMode !== EModelImmutableMode.eOff) {
            model.immutable((nextSubModel: Model<any>) => {
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
