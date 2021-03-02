import "typescript/lib/tsserverlibrary";

declare module "typescript/lib/tsserverlibrary" {
    export function getTokenAtPosition(
        sourceFile: SourceFile,
        position: number
    ): Node;
}
