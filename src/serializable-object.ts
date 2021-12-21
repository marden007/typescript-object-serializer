import { RecursivePartial } from './base-types/recursive-partial';
import { Extractor } from './decorators/property/base-extractor';
import {
  SERIALIZABLE_PROPERTIES_KEY,
  SERIALIZABLE_TYPES_KEY,
} from './metadata-keys';
import { clone } from './methods/clone';
import { create } from './methods/create';

type RecursiveWithoutBase<T> = {
  [K in keyof T]: T[K] extends SerializableObject ?
  SerializableObjectWithoutBase<T[K]> :
  T[K] extends Array<SerializableObject> ?
  Array<SerializableObjectWithoutBase<T[K][number]>> :
  T[K];
};

export type SerializableObjectWithoutBase<T extends Partial<SerializableObject>> =
  RecursiveWithoutBase<Pick<T, Exclude<keyof T, keyof SerializableObject>>>;

type SerializableObjectData<T extends typeof SerializableObject, I = InstanceType<T>> =
  RecursivePartial<SerializableObjectWithoutBase<I>>;

export class NonArrayDataError extends Error {
  constructor() {
    super('Array data should be passed to deserializeArray method');
  }
}

/**
 * SerializableObject - basic class for serializable descendants
 */
export class SerializableObject {

  /**
   * @method create Create SerializableObject instance
   * @param data Plain object structured as current class
   * @returns Instance of current class
   */
  public static create<T extends typeof SerializableObject>(
    this: T,
    data: SerializableObjectData<T> = {},
  ): InstanceType<T> {
    return create(this as any, data);
  }

  /**
   * @method deserialize Deserialize object to class
   * @param data { any } Object of serialized data
   * @returns Instance of current Serializable class
   */
  public static deserialize<T extends typeof SerializableObject>(
    this: T,
    data: any,
  ): InstanceType<T> {

    const instance = new this() as InstanceType<T>;

    const props: Map<keyof InstanceType<T>, Extractor> = (this as any)[SERIALIZABLE_PROPERTIES_KEY];

    if (!props) {
      return instance;
    }

    Array.from(props.keys()).forEach(
      key => {
        const keyTypes: Map<keyof InstanceType<T>, any> = (this as any)[SERIALIZABLE_TYPES_KEY];
        const keyTypeFunctionOrConstructor = keyTypes?.get(key) ||
          (
            (Reflect as any).getMetadata &&
            (Reflect as any).getMetadata('design:type', instance, key as string | symbol)
          );

        const extractor: Extractor | undefined = props.get(key);

        const objectData = extractor?.extract(data);

        if (!objectData) {
          /* If objectData === undefined than instance[key] should have default value from class description */
          if (objectData !== undefined) {
            /* null / 0 / '' / false */
            instance[key] = objectData;
          }

          return;
        }

        if (Array.isArray(objectData)) {
          if (keyTypeFunctionOrConstructor?.prototype instanceof SerializableObject) {
            instance[key] = objectData.map(item => keyTypeFunctionOrConstructor.deserialize(item)) as any;
          } else if (typeof keyTypeFunctionOrConstructor === 'function') {
            instance[key] = objectData.map(item => {
              const itemType = keyTypeFunctionOrConstructor(item);
              if (!itemType || !(itemType?.prototype instanceof SerializableObject)) {
                return item;
              }
              return itemType.deserialize(item);
            }) as any;
          } else {
            instance[key] = objectData as any;
          }
          return;
        }

        const getKeyTypeFromFunction = () => {
          try {
            const typeFromFunction = keyTypeFunctionOrConstructor(objectData);
            if (typeFromFunction.prototype instanceof SerializableObject) {
              return typeFromFunction;
            }
          } catch {
          }
        }

        const keyType = keyTypeFunctionOrConstructor?.prototype instanceof SerializableObject ?
          keyTypeFunctionOrConstructor :
          getKeyTypeFromFunction();

        if (!keyType) {
          instance[key] = extractor?.extract(data);
          return;
        }

        instance[key] = keyType.deserialize(objectData);
      }
    );

    return instance;

  }

  /**
   * @method deserialize Deserialize array of objects
   * @param data { Array } Array of serialized data
   * @returns Array of current Serializable class items
   */
  public static deserializeArray<T extends typeof SerializableObject>(
    this: T,
    data: any[],
  ): InstanceType<T>[] {
    if (!Array.isArray(data)) {
      throw new NonArrayDataError();
    }
    return data.map(data => this.deserialize(data));
  }

  /**
   * @method serialize Serialize current instance
   * @returns { any } Object of serialized data
   */
  public serialize(): any {
    const data = {};

    const keys: Map<keyof this, Extractor> = (this as any).constructor[SERIALIZABLE_PROPERTIES_KEY];
    Array.from(keys.keys()).forEach(
      key => {
        const extractor = keys.get(key);
        const value = this[key];
        const serializedValue = value instanceof SerializableObject ?
          value.serialize() :
          value;
        if (serializedValue !== undefined) {
          extractor?.apply(data, serializedValue);
        }
      },
    );

    return data;
  }

  /**
   * @method clone Create same object as current (including deep serializable instances)
   * @returns New instance of current instance class
   */
  public clone(): this {
    return clone(this);
  }
}
