import { ModelDefinition }        from './definition';
import { DescFieldSubModelArray } from './fieldSubModelArray';
import { ModelDescription }       from './modelDescription';

export class DeepSubModelDefinition<TDesc extends ModelDescription = ModelDescription>
    extends ModelDefinition<TDesc> {

    get field() {
        return this._field;
    }

    constructor(desc: TDesc, label: string, private _field: DescFieldSubModelArray) {
        super('', '', label, desc);
    }
}