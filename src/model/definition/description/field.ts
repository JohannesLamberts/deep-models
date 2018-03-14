import {
    DescKeyBase,
    EDescType
}                     from './base';
import { EFieldType } from './fieldTypes';
import {
    Validator,
    ValidatorRequired
}                     from './validator';

export default class<TValInterface, TValInner = TValInterface> extends DescKeyBase {

    private _validators: Validator[] = [];

    get validators() {
        return this._validators.slice();
    }

    get fieldType(): EFieldType {
        return this._fieldType;
    }

    get isArray(): boolean {
        return this._isArray;
    }

    get required(): boolean {
        return this._validators.some(validator => validator instanceof ValidatorRequired);
    }

    constructor(label: string,
                private _fieldType: EFieldType,
                private _isArray: boolean = false) {
        super(label, EDescType.eField);
        if (this._fieldType === EFieldType.eSubModel && !this._isArray) {
            throw new Error(`FieldType eSubModel is only allowed as Array.`);
        }
    }

    public getDefaultVal(): any {
        if (this._isArray) {
            return [];
        }
        switch (this._fieldType) {
            case EFieldType.eBoolean:
                return false;
            case EFieldType.eDate:
                return null;
            case EFieldType.eEnum:
                return 0;
            case EFieldType.eFloat:
                return 0;
            case EFieldType.eInteger:
                return 0;
            case EFieldType.eReference:
                return null;
            case EFieldType.eString:
                return '';
            default:
                throw new Error(`ENotImplemented for fieldType '${this._fieldType}'`);
        }
    }

    public pushValidators(...validators: Validator[]): this {
        this._validators.push(...validators);
        return this;
    }

    public pushValidatorRequired(): this {
        this._validators.push(new ValidatorRequired());
        return this;
    }

    public convertToDocument(val: TValInner): any {
        return val;
    }

    public convertFromDocument(val: any): TValInner {
        return val;
    }
}