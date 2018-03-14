import { DeepModelDefinition } from '../model/definition/definition';
import { DescField }           from '../model/definition/description';
import {
    DeepModelFilterField,
    DeepModelFilterJSONField,
    DeepModelFilterMongoField,
    TDeepModelCompare
}                              from './filterField';

export interface DeepModelFilterMongo {
    [key: string]: DeepModelFilterMongoField;
}

export interface DeepModelFilterJSON {
    [key: string]: DeepModelFilterJSONField<any>;
}

export class DeepModelFilter {

    private _fullfillable = true;

    private _fields = new Map<DescField<any>, DeepModelFilterField<any>>();

    // TODO: replace with safe accessor
    get fields() {
        return this._fields;
    }

    public static fromJSON(json: DeepModelFilterJSON,
                           modelDefinition: DeepModelDefinition): DeepModelFilter {

        const filter = new DeepModelFilter();
        for (const fieldIndex in json) {
            if (!json.hasOwnProperty(fieldIndex)) {
                continue;
            }
            filter._fields.set(
                modelDefinition.fields[parseInt(fieldIndex, 10)].field,
                DeepModelFilterField.fromJSON(json[fieldIndex]));
        }
        return filter;
    }

    public add<TInterface, TStorage>(desc: DescField<TInterface, TStorage>,
                                     type: TDeepModelCompare,
                                     value: TInterface | TInterface[]) {
        if (!this._fullfillable) {
            return;
        }

        if (!this._fields.has(desc)) {
            this._fields.set(desc, new DeepModelFilterField());
        }

        if (!(this._fields.get(desc)!).add(type, value)) {
            this._fullfillable = false;
        }
    }

    public toJson(modelDefinition: DeepModelDefinition): DeepModelFilterJSON {
        if (!this._fullfillable) {
            throw new Error(`Can't generate JSON for not fullfillable filter`);
        }
        const jsonData: DeepModelFilterJSON = {};
        this._fields.forEach((val, key) => {
            jsonData[modelDefinition.getFieldIndex(key)] = val.toJSON();
        });
        return jsonData;
    }

    public toMongo(modelDefinition: DeepModelDefinition): DeepModelFilterMongo {
        const mongoFilter: Record<string, DeepModelFilterMongoField> = {};
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

    public andNotEnsuredBy(b: DeepModelFilter): DeepModelFilter[] {
        const unensuredFilters: DeepModelFilter[] = [];
        /*
         *    F_a and not F_b
         * -> F_b.constraints().map(F_b_constraint => F_a and not F_b_constraint) [OR]
         */
        b._fields.forEach((subFilter, subField) => {
            const newUnensuredFilters: DeepModelFilter[] = [];
            subFilter.subtractFromCloneOf(() => {
                const filterClone = this._cloneDeep();
                if (!filterClone._fields.has(subField)) {
                    filterClone._fields.set(subField, new DeepModelFilterField());
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

    public andNotEnsuredByMultiple(bArr: DeepModelFilter[]): DeepModelFilter[] {
        let unEnsuredFilters: DeepModelFilter[] = [this];
        for (let i = 0; i < bArr.length; i++) {
            // replace all unEnsuredFilters with their result DeepModelFilter[] (A and NOT B)
            const nextStage: DeepModelFilter[] = [];
            for (let j = 0; j < unEnsuredFilters.length; j++) {
                nextStage.push(...unEnsuredFilters[j].andNotEnsuredBy(bArr[i]));
            }
            unEnsuredFilters = nextStage;
        }
        return unEnsuredFilters;
    }

    private _cloneDeep(): DeepModelFilter {
        const copy = new DeepModelFilter();
        this._fields.forEach((value, key) => {
            copy._fields.set(key, value.clone());
        });
        return copy;
    }
}
