import { EFieldType }    from './description';
import DescField         from './description/field';
import { ValidatorEnum } from './description/validator';

export class DescFString extends DescField<string> {
    constructor(label: string) {
        super(label, EFieldType.eString);
    }
}

export class DescFStringArr extends DescField<string[]> {
    constructor(label: string) {
        super(label, EFieldType.eString, true);
    }
}

export class DescFStringMultiline extends DescField<string> {
    constructor(label: string) {
        super(label, EFieldType.eString);
    }
}

export class DescFSelect extends DescField<string> {
    constructor(label: string, private _options: Record<string, string>) {
        super(label, EFieldType.eString);
    }

    getOptions(): { value: string; label: string; }[] {
        return Object.keys(this._options).map(key => ({
            value: key,
            label: this._options[key]
        }));
    }
}

export class DescFSelectMultiple extends DescField<string[]> {
    constructor(label: string, private _options: Record<string, string>) {
        super(label, EFieldType.eString, true);
    }

    getOptions(): { value: string; label: string }[] {
        return Object.keys(this._options).map(key => ({
            value: key,
            label: this._options[key]
        }));
    }
}

export class DescFInteger extends DescField<number> {
    constructor(label: string) {
        super(label, EFieldType.eInteger);
    }
}

export class DescFIntegerArr extends DescField<number[]> {
    constructor(label: string) {
        super(label, EFieldType.eInteger, true);
    }
}

export class DescFFloat extends DescField<number> {
    constructor(label: string) {
        super(label, EFieldType.eFloat);
    }
}

export class DescFBoolean extends DescField<boolean> {
    constructor(label: string) {
        super(label, EFieldType.eBoolean);
    }
}

export class DescFBooleanArr extends DescField<boolean> {
    constructor(label: string) {
        super(label, EFieldType.eBoolean, true);
    }
}

export abstract class DescFDateOrTime extends DescField<Date, Date> {
    constructor(label: string) {
        super(label, EFieldType.eDate);
    }
}

export class DescFDate extends DescFDateOrTime {
}

export class DescFDateTime extends DescFDateOrTime {
}

export class DescFTime extends DescFDateOrTime {
}

export class DescFEnum<TEnum> extends DescField<TEnum> {
    constructor(label: string, enumerator: any) {
        super(label, EFieldType.eEnum);
        this.pushValidators(new ValidatorEnum(enumerator));
    }
}

export class DescFObj extends DescField<boolean> {
    constructor(label: string) {
        super(label, EFieldType.eObj);
    }
}