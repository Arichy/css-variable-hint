class TreeCacheNode<K, V> {
  childMap: Map<K, TreeCacheNode<K, V>>;
  value: V;

  constructor(value: V) {
    this.value = value;
    this.childMap = new Map<K, TreeCacheNode<K, V>>();
  }

  has(keys: readonly K[], index: number): boolean {
    const currentKey = keys[index];

    if (index === keys.length - 1) {
      // last level
      if (this.childMap.has(currentKey)) {
        return true;
      } else {
        return false;
      }
    } else {
      // not last level
      if (this.childMap.has(currentKey)) {
        return this.childMap.get(currentKey).has(keys, index + 1);
      } else {
        return false;
      }
    }
  }

  get(keys: readonly K[], index: number): V | undefined {
    const currentKey = keys[index];

    if (index === keys.length - 1) {
      // last level
      if (this.childMap.has(currentKey)) {
        return this.childMap.get(currentKey).value;
      } else {
        return undefined;
      }
    } else {
      // not last level
      if (this.childMap.has(currentKey)) {
        return this.childMap.get(currentKey).get(keys, index + 1);
      } else {
        return undefined;
      }
    }
  }

  getNode(keys: readonly K[], index): TreeCacheNode<K, V> | null {
    const currentKey = keys[index];

    if (index === keys.length - 1) {
      if (this.childMap.has(currentKey)) {
        return this.childMap.get(currentKey);
      } else {
        return null;
      }
    } else {
      if (this.childMap.has(currentKey)) {
        return this.childMap.get(currentKey).getNode(keys, index + 1);
      } else {
        return null;
      }
    }
  }

  set(keys: readonly K[], value: V, index: number) {
    const currentKey = keys[index];

    if (index === keys.length - 1) {
      // last level
      if (!this.childMap.has(currentKey)) {
        this.childMap.set(currentKey, new TreeCacheNode<K, V>(value));
      } else {
        this.childMap.get(currentKey).value = value;
      }
    } else {
      // not last level
      if (!this.childMap.has(currentKey)) {
        const emptyNode = new TreeCacheNode<K, V>(null);
        this.childMap.set(currentKey, emptyNode);
        emptyNode.set(keys, value, index + 1);
      } else {
        this.childMap.get(currentKey).set(keys, value, index + 1);
      }
    }
  }

  delete(keys: readonly K[], index: number) {
    const currentKey = keys[index];

    if (!this.childMap.has(currentKey)) {
      return;
    }

    if (index === keys.length - 1) {
      // last level
      const node = this.childMap.get(currentKey);
      if (node.childMap.size === 0) {
        // leaf
        this.childMap.delete(currentKey);
      } else {
        node.value = null;
      }
    } else {
      // not last level
      this.childMap.get(currentKey).delete(keys, index + 1);
    }
  }

  deleteSubTree(keys: readonly K[], index: number) {
    const currentKey = keys[index];

    if (!this.childMap.has(currentKey)) {
      return;
    }

    if (index === keys.length - 1) {
      this.childMap.delete(currentKey);
    } else {
      this.childMap.get(currentKey).deleteSubTree(keys, index + 1);
    }
  }
}

export default class TreeCache<K, V> {
  root: TreeCacheNode<K, V>;

  constructor() {
    this.root = new TreeCacheNode(null);
  }

  has(keys: readonly K[]): boolean {
    return this.root.has(keys, 0);
  }

  get(keys: readonly K[]): V | undefined {
    return this.root.get(keys, 0);
  }

  getNode(keys: readonly K[]): TreeCacheNode<K, V> | null {
    return this.root.getNode(keys, 0);
  }

  set(keys: readonly K[], value: V) {
    this.root.set(keys, value, 0);
  }

  delete(keys: readonly K[]) {
    this.root.delete(keys, 0);
  }

  deleteSubTree(keys: readonly K[]) {
    this.root.deleteSubTree(keys, 0);
  }

  clear() {
    this.root = new TreeCacheNode(null);
  }
}
