import { DeepModelFilter } from '../filter';
import { DeepModel }       from '../model/model';

export const modelPassesFilter = (model: DeepModel<any>,
                                  filter: DeepModelFilter): boolean => {

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