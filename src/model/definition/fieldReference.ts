import {
    DescField,
    EFieldType
} from './description/index';

export class DeepModelDependency {

    get field(): AbstractDescFReference<any> {
        return this._field;
    }

    constructor(private _field: AbstractDescFReference<any>) {
    }
}

export abstract class AbstractDescFReference<T> extends DescField<T> {

    get refTarget(): string {
        return this._refTarget;
    }

    constructor(label: string, protected _refTarget: string, isArr: boolean = false) {
        super(label, EFieldType.eReference, isArr);
    }
}

export class DescFReference extends AbstractDescFReference<string> {
}

export class DescFReferenceArr extends AbstractDescFReference<string[]> {
    constructor(label: string, refTarget: string) {
        super(label, refTarget, true);
    }
}