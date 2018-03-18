import { DescField } from './definition/description/index';
import { Model }     from './model';

export class ModelFPtr<TVal,
    TField extends DescField<TVal, TVal> = DescField<TVal, TVal>> {

    private _fieldIndex: number;

    constructor(protected _obj: Model, protected _field: TField) {
        this._fieldIndex = this._obj.modelDefinition.getFieldIndex(this._field);
    }

    public set(value: TVal): this {
        this._obj.updatePayload(this._fieldIndex, value);
        return this;
    }

    public get(): TVal {
        return this._obj.payload.get(this._fieldIndex);
    }
}