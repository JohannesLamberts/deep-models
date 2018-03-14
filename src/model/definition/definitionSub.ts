import { DeepModelDefinition }    from './definition';
import { DescFieldSubModelArray } from './fieldSubModelArray';
import { DeepModelDescription }   from './modelDescription';

export class DeepSubModelDefinition<TDesc extends DeepModelDescription = DeepModelDescription>
    extends DeepModelDefinition<TDesc> {

    get field() {
        return this._field;
    }

    constructor(desc: TDesc, label: string, private _field: DescFieldSubModelArray) {
        super('', '', label, desc);
    }
}