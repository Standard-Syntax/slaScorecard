/*
 *  Power BI type augmentations.
 *
 *  powerbi-visuals-api's public TypeScript types omit some runtime members
 *  that the Power BI host actually provides. This module augments the
 *  package's ambient module to surface those members for type-safe use.
 *
 *  Being a real module (with an `import` statement) makes this an
 *  AUGMENTATION, not a replacement. In a `.d.ts` script, `declare module`
 *  replaces the package's own ambient module declaration, which would
 *  clobber all other types from the package.
 */
import "powerbi-visuals-api";

declare module "powerbi-visuals-api" {
    namespace visuals {
        interface ISelectionId {
            toString(): string;
        }
    }
}
