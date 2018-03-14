import { EFieldType } from './fieldTypes';

export class ValidationError {
    constructor(public readonly message: string) {
    }
}

export abstract class Validator {
    public abstract checkFor(value: any): ValidationError | void;
}

export class ValidatorRequired extends Validator {
    public checkFor(value: any): ValidationError | void {
        if (!value) {
            return new ValidationError('Pflichtfeld');
        }
    }
}

export class ValidatorEnum extends Validator {
    constructor(private _enumerator: any) {
        super();
    }

    public checkFor(value: any): ValidationError | void {
        if (!this._enumerator[value]) {
            return new ValidationError('Falscher Wert (Enum)');
        }
    }
}

export class ValidatorType<T> extends Validator {
    constructor(private _fieldType: EFieldType) {
        super();
    }

    public checkFor(value: any): ValidationError | void {
        let ok = false;
        const type = typeof value;
        switch (this._fieldType) {
            case EFieldType.eBoolean:
                ok = type === 'boolean';
                break;
            case EFieldType.eFloat:
                ok = type === 'number';
                break;
            case EFieldType.eInteger:
            case EFieldType.eEnum:
                ok = type === 'number' && value % 1 === 0;
                break;
            case EFieldType.eString:
                ok = type === 'string';
                break;
            case EFieldType.eSubModel:
                ok = type === 'object';
                break;
            default:
                throw new Error(`Field type validator not implemented:`
                    + `${this._fieldType}(${EFieldType[this._fieldType]})`);
        }

        if (!ok) {
            return new ValidationError('Fehlerhafter Typ');
        }
    }
}

export class ValidatorRegex extends Validator {
    constructor(private _regex: RegExp) {
        super();
    }

    public checkFor(value: string): ValidationError | void {
        if (!this._regex.test(value)) {
            return new ValidationError('Falsches Eingabeformat');
        }
    }
}

export const kChValidatorRequired = new ValidatorRequired();

// from http://emailregex.com/
export const kChValidatorRegExMail =
                 new ValidatorRegex(new RegExp(
                     `^(([^<>()\\[\\]\\\\.,;:\\s@"]+(\\.[^<>()\\[\\]\\\\.,;:\\s@"]+)*)|(".+"))@`
                     + `((\\[[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}])|`
                     + `(([a-zA-Z\\-0-9]+\\.)+[a-zA-Z]{2,}))$`));

// Original
// ^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]
// {1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$
