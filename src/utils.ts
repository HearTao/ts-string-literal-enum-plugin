import type * as ts from "typescript/lib/tsserverlibrary";
import {
    convertEnumIntoStringLiteralActionDescription,
    convertEnumIntoStringLiteralActionName,
    convertEnumMemberIntoStringLiteralActionDescription,
    convertEnumMemberIntoStringLiteralActionName
} from "./constants";

export function getPositionOfPositionOrRange(
    positionOrRange: number | ts.TextRange
) {
    return typeof positionOrRange === "number"
        ? positionOrRange
        : positionOrRange.pos;
}

export function kindToActionNameAndDesc(
    kind: ts.SyntaxKind.EnumMember | ts.SyntaxKind.EnumDeclaration,
    typescript: typeof ts
) {
    return kind === typescript.SyntaxKind.EnumDeclaration
        ? ([
              convertEnumIntoStringLiteralActionName,
              convertEnumIntoStringLiteralActionDescription
          ] as const)
        : ([
              convertEnumMemberIntoStringLiteralActionName,
              convertEnumMemberIntoStringLiteralActionDescription
          ] as const);
}

export function isConvertibleMemberOfEnum(
    enumMember: ts.EnumMember,
    checker: ts.TypeChecker
) {
    return (
        !enumMember.initializer ||
        typeof checker.getConstantValue(enumMember) === "string"
    );
}

export function isConvertibleEnumMember(enumMember: ts.EnumMember) {
    return !enumMember.initializer;
}

export function assert(v: any, message?: string): asserts v {
    if (!v) {
        throw new Error(message ?? "Assertion failed");
    }
}
