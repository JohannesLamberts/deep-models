import { expect }    from 'chai';
import 'mocha';
import {
    kModelPayloadRootSegment,
    ModelDefinition
}                    from './definition/definition';
import {
    DescField,
    EFieldType
}                    from './definition/description';
import { ModelFPtr } from './fPtr';
import { Model }     from './model';

const modelDef = new ModelDefinition(
    'MODULE',
    'IDENT',
    'TEST_OBJECT',
    {
        string: new DescField('FIELD_NAME_STRING', EFieldType.eString)
    });

const desc = modelDef.rootDescription;

const ModelInitial = Model.fromDataArray(
    modelDef.documentToArr({ [kModelPayloadRootSegment]: { string: 'string' } }),
    modelDef);

describe('ModelFPtr', function () {

    const model = ModelInitial.getClone();
    const fPtr = new ModelFPtr(model, desc.string);

    it('should return the field value', function () {
        expect(fPtr.get()).to.equal('string');
    });

    it('should set the correct field value', function () {
        fPtr.set('string_set');
        expect(fPtr.get()).to.equal('string_set');
    });
});