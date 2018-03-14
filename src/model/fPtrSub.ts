import { DeepModelDefinition }    from './definition/definition';
import { DescFieldSubModelArray } from './definition/fieldSubModelArray';
import { DeepModelDescription }   from './definition/modelDescription';
import { DeepModelFPtr }          from './fPtr';
import { generateID }             from './generateId';
import { DeepModel }              from './model';

export class DeepModelFPtrSub<TDesc extends DeepModelDescription>
    extends DeepModelFPtr<any[], any[], DescFieldSubModelArray<TDesc>> {

    pushChild(cb?: (model: DeepModel<DeepModelDefinition<TDesc>>, def: TDesc) => void): this {
        let data = this._field.subDefinition.getDefaultData();
        data[0] = generateID();
        if (cb) {
            const tmpModel = DeepModel.fromDataArray(data, this._field.subDefinition);
            cb(tmpModel, this._field.subDesc);
            data = tmpModel.payload.slice();
        }
        this.set([
                     ...this.get(),
                     data
                 ]);
        return this;
    }

    pullChild(index: number): this {
        const copy = this.getRaw().slice();
        copy.splice(index, 1);
        this.setRaw(copy);
        return this;
    }

    getChildModels(): DeepModel<DeepModelDefinition<TDesc>>[] {
        return this.getRaw()
                   .map((subVal, index) =>
                            this._obj.subModelFor(subVal, index, this._field));
    }

    updateChild(i: number, cb: (model: DeepModel<DeepModelDefinition<TDesc>>, def: TDesc) => void): this {
        cb(this.getChildModels()[i], this._field.subDesc);
        return this;
    }
}
