import { propertyType } from '../../src/decorators/property-type/type';
import { property } from '../../src/decorators/property/property';
import { SerializableObject } from '../../src/serializable-object';

describe('Decorator @propertyType', () => {

  class TestProperty extends SerializableObject {
    @property()
    public value: string;
  }

  class SuccessResult extends SerializableObject { }
  class FailedResult extends SerializableObject { }

  class Test extends SerializableObject {

    @property()
    @propertyType(TestProperty)
    public property: any;

    @property()
    @propertyType(TestProperty)
    public arrayProperty: TestProperty[];

    @property()
    @propertyType((value: any) => value?.success ? SuccessResult : FailedResult)
    public conditionalPropertyType: SuccessResult | FailedResult;

    @property()
    @propertyType((value: any) => value?.success ? SuccessResult : FailedResult)
    public arrayWithConditionalPropertyType: Array<SuccessResult | FailedResult>;

  }

  describe('simple property', () => {

    it('should deserialize property to passed type', () => {
      const deserialized = Test.deserialize({
        property: {
          value: '123',
        },
      });
      expect(deserialized.property).toBeInstanceOf(TestProperty);
    });

  });

  describe('array property', () => {

    it('should deserialize array items to passed type', () => {
      const deserialized = Test.deserialize({
        arrayProperty: [
          {
            value: '123',
          },
          {
            value: '456',
          },
        ],
      });
      expect(deserialized.arrayProperty[0]).toBeInstanceOf(TestProperty);
      expect(deserialized.arrayProperty[1]).toBeInstanceOf(TestProperty);
    });

  });

  describe('conditional property', () => {

    it('should deserialize value to type depends on condition', () => {
      const deserializedSuccess = Test.deserialize({
        conditionalPropertyType: {
          success: true,
        },
      });
      const deserializedFailed = Test.deserialize({
        conditionalPropertyType: {
          success: false,
        },
      });

      expect(deserializedSuccess.conditionalPropertyType).toBeInstanceOf(SuccessResult);
      expect(deserializedFailed.conditionalPropertyType).toBeInstanceOf(FailedResult);
    });

  });

  describe('conditional array property', () => {

    it('should deserialize array values to type depends on condition', () => {
      const deserialized = Test.deserialize({
        arrayWithConditionalPropertyType: [
          {
            success: true,
          },
          {
            success: false,
          },
        ],
      });

      expect(deserialized.arrayWithConditionalPropertyType[0]).toBeInstanceOf(SuccessResult);
      expect(deserialized.arrayWithConditionalPropertyType[1]).toBeInstanceOf(FailedResult);
    });

  });

});
