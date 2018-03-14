import { DescField } from './definition/description/index';
import { DeepModel } from './model';

export class DeepModelFPtr<TValInterface,
    TValInner = TValInterface,
    TField extends DescField<TValInterface, TValInner> = DescField<TValInterface, TValInner>> {

    private _fieldIndex: number;

    constructor(protected _obj: DeepModel, protected _field: TField) {
        this._fieldIndex = this._obj.modelDefinition.getFieldIndex(this._field);
    }

    public set(value: TValInterface): this {
        this.setRaw(this._convertToObj(value));
        return this;
    }

    public setRaw(value: TValInner): this {
        this._obj.updatePayload(this._fieldIndex, value);
        return this;
    }

    public get(): TValInterface {
        return this._convertFromObj(this.getRaw());
    }

    public getRaw(): TValInner {
        return this._obj.payload.get(this._fieldIndex);
    }

    protected _convertToObj(val: TValInterface): TValInner {
        return val as any as TValInner;
    }

    protected _convertFromObj(val: TValInner) {
        return val as any as TValInterface;
    }
}