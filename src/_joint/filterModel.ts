import { ModelFilter } from '../filter';
import { Model }       from '../model/model';

export const modelPassesFilter = (model: Model<any>,
                                  filter: ModelFilter): boolean => {

    let passes = true;
    filter.fields.forEach((filterField, desc) => {
        if (!passes) {
            return;
        }
        if (!filterField.passes(model.fPtr(desc).get())) {
            passes = false;
        }
    });

    return passes;

};