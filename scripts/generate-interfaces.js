"use strict";

const fs = require("fs");
const t = require("../packages/babel-types");

const NODE_PREFIX = "BabelNode";

let code = `// NOTE: This file is autogenerated. Do not modify.
// See scripts/generate-interfaces.js for script used.

declare class ${NODE_PREFIX}Comment {
  value: string;
  start: number;
  end: number;
  loc: ${NODE_PREFIX}SourceLocation;
}

declare class ${NODE_PREFIX}BlockComment extends ${NODE_PREFIX}Comment {
  type: "BlockComment";
}

declare class ${NODE_PREFIX}LineComment extends ${NODE_PREFIX}Comment {
  type: "LineComment";
}

declare class ${NODE_PREFIX}SourceLocation {
  start: {
    line: number;
    column: number;
  };

  end: {
    line: number;
    column: number;
  };
}

declare class ${NODE_PREFIX} {
  leadingComments: ?Array<${NODE_PREFIX}Comment>;
  innerComments: ?Array<${NODE_PREFIX}Comment>;
  trailingComments: ?Array<${NODE_PREFIX}Comment>;
  start: ?number;
  end: ?number;
  loc: ?${NODE_PREFIX}SourceLocation;
}\n\n`;

//

const lines = [];

for (const type in t.NODE_FIELDS) {
  const fields = t.NODE_FIELDS[type];

  const struct = ['type: "' + type + '";'];
  const args = [];

  Object.keys(t.NODE_FIELDS[type])
    .sort((fieldA, fieldB) => {
      const indexA = t.BUILDER_KEYS[type].indexOf(fieldA);
      const indexB = t.BUILDER_KEYS[type].indexOf(fieldB);
      if (indexA === indexB) return fieldA < fieldB ? -1 : 1;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    })
    .forEach(fieldName => {
      const field = fields[fieldName];

      let suffix = "";
      if (field.optional || field.default != null) suffix += "?";

      let typeAnnotation = "any";

      const validate = field.validate;
      if (validate) {
        if (validate.oneOf) {
          typeAnnotation = validate.oneOf
            .map(function(val) {
              return JSON.stringify(val);
            })
            .join(" | ");
        }

        if (validate.type) {
          typeAnnotation = validate.type;

          if (typeAnnotation === "array") {
            typeAnnotation = "Array<any>";
          }
        }

        if (validate.oneOfNodeTypes) {
          const types = validate.oneOfNodeTypes.map(
            type => `${NODE_PREFIX}${type}`
          );
          typeAnnotation = types.join(" | ");
          if (suffix === "?") typeAnnotation = "?" + typeAnnotation;
        }
      }

      if (typeAnnotation) {
        suffix += ": " + typeAnnotation;
      }

      args.push(t.toBindingIdentifierName(fieldName) + suffix);

      if (t.isValidIdentifier(fieldName)) {
        struct.push(fieldName + suffix + ";");
      }
    });

  code += `declare class ${NODE_PREFIX}${type} extends ${NODE_PREFIX} {
  ${struct.join("\n  ").trim()}
}\n\n`;

  // Flow chokes on super() and import() :/
  if (type !== "Super" && type !== "Import") {
    lines.push(
      `declare function ${type[0].toLowerCase() + type.slice(1)}(${args.join(
        ", "
      )}): ${NODE_PREFIX}${type};`
    );
  }
}

for (let i = 0; i < t.TYPES.length; i++) {
  let decl = `declare function is${t.TYPES[
    i
  ]}(node: Object, opts?: ?Object): boolean`;

  if (t.NODE_FIELDS[t.TYPES[i]]) {
    decl += ` %checks (node instanceof ${NODE_PREFIX}${t.TYPES[i]})`;
  }

  lines.push(decl);
}

lines.push(
  `declare function validate(n: BabelNode, key: string, value: mixed): void;`,
  `declare function clone<T>(n: T): T;`,
  `declare function cloneDeep<T>(n: T): T;`,
  `declare function removeProperties<T>(n: T, opts: ?{}): void;`,
  `declare function removePropertiesDeep<T>(n: T, opts: ?{}): T;`
);

for (const type in t.FLIPPED_ALIAS_KEYS) {
  const types = t.FLIPPED_ALIAS_KEYS[type];
  code += `type ${NODE_PREFIX}${type} = ${types
    .map(type => `${NODE_PREFIX}${type}`)
    .join(" | ")};\n`;
}

code += `\ndeclare module "babel-types" {
  ${lines
    .join("\n")
    .replace(/\n/g, "\n  ")
    .trim()}
}\n`;

//

fs.writeFileSync(__dirname + "/../lib/types.js", code);
