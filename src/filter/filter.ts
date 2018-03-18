import { ModelDefinition } from '../model/definition/definition';
import { DescField }       from '../model/definition/description';
import {
    ModelFilterField,
    ModelFilterJSONField,
    ModelFilterMongoField,
    TModelCompare
}                          from './filterField';

export interface ModelFilterMongo {
    [key: string]: ModelFilterMongoField;
}

export interface ModelFilterJSON {
    [key: string]: ModelFilterJSONField<any>;
}

export class ModelFilter {

    private _fullfillable = true;

    private _fields = new Map<DescField<any>, ModelFilterField<any>>();

    // TODO: replace with safe accessor
    get fields() {
        return this._fields;
    }

    public static fromJSON(json: ModelFilterJSON,
                           modelDefinition: ModelDefinition): ModelFilter {

        const filter = new ModelFilter();
        for (const fieldIndex in json) {
            if (!json.hasOwnProperty(fieldIndex)) {
                continue;
            }
            filter._fields.set(
                modelDefinition.fields[parseInt(fieldIndex, 10)].field,
                ModelFilterField.fromJSON(json[fieldIndex]));
        }
        return filter;
    }

    public add<TInterface, TStorage>(desc: DescField<TInterface, TStorage>,
                                     type: TModelCompare,
                                     value: TInterface | TInterface[]) {
        if (!this._fullfillable) {
            return;
        }

        if (!this._fields.has(desc)) {
            this._fields.set(desc, new ModelFilterField());
        }

        if (!(this._fields.get(desc)!).add(type, value)) {
            this._fullfillable = false;
        }
    }

    public toJson(modelDefinition: ModelDefinition): ModelFilterJSON {
        if (!this._fullfillable) {
            throw new Error(`Can't generate JSON for not fullfillable filter`);
        }
        const jsonData: ModelFilterJSON = {};
        this._fields.forEach((val, key) => {
            jsonData[modelDefinition.getFieldIndex(key)] = val.toJSON();
        });
        return jsonData;
    }

    public toMongo(modelDefinition: ModelDefinition): ModelFilterMongo {
        const mongoFilter: Record<string, ModelFilterMongoField> = {};
        const defFields = modelDefinition.fields;
        this._fields.forEach((val, key) => {
            const fieldIndex = modelDefinition.getFieldIndex(key);
            const fieldMeta = defFields[fieldIndex];
            mongoFilter[['payload',
                         fieldMeta.segmentKey,
                         fieldMeta.key].join('.')] = val.toMongo();
        });
        return mongoFilter;
    }

    public andNotEnsuredBy(b: ModelFilter): ModelFilter[] {
        const unensuredFilters: ModelFilter[] = [];
        /*
         *    F_a and not F_b
         * -> F_b.constraints().map(F_b_constraint => F_a and not F_b_constraint) [OR]
         */
        b._fields.forEach((subFilter, subField) => {
            const newUnensuredFilters: ModelFilter[] = [];
            subFilter.subtractFromCloneOf(() => {
                const filterClone = this._cloneDeep();
                if (!filterClone._fields.has(subField)) {
                    filterClone._fields.set(subField, new ModelFilterField());
                }
                newUnensuredFilters.push(filterClone);
                const field = filterClone._fields.get(subField);
                if (!field) {
                    throw new Error(`No field found for ${subField}`);
                }
                return field;
            });

            // add unensured filters with subtracted fields
            unensuredFilters.push(
                ...newUnensuredFilters
                // remove those filters, that are not fullfillable
                    .filter(unensuredFilter => {
                        const field = unensuredFilter._fields.get(subField);
                        if (!field) {
                            throw new Error(`No field found for ${subField}`);
                        }
                        return field.isFullfillable();
                    }));
        });

        return unensuredFilters;
    }

    public andNotEnsuredByMultiple(bArr: ModelFilter[]): ModelFilter[] {
        let unEnsuredFilters: ModelFilter[] = [this];
        for (let i = 0; i < bArr.length; i++) {
            // replace all unEnsuredFilters with their result ModelFilter[] (A and NOT B)
            const nextStage: ModelFilter[] = [];
            for (let j = 0; j < unEnsuredFilters.length; j++) {
                nextStage.push(...unEnsuredFilters[j].andNotEnsuredBy(bArr[i]));
            }
            unEnsuredFilters = nextStage;
        }
        return unEnsuredFilters;
    }

    private _cloneDeep(): ModelFilter {
        const copy = new ModelFilter();
        this._fields.forEach((value, key) => {
            copy._fields.set(key, value.clone());
        });
        return copy;
    }
}
