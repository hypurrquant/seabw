import { BadRequestException, PipeTransform } from "@nestjs/common";
import type { ZodTypeAny } from "zod";

export interface ZodValidationPipeOptions {
  /** 응답 envelope의 `error` 필드에 들어갈 메시지. 기본 "Validation failed". */
  errorMessage?: string;
}

export class ZodValidationPipe<T extends ZodTypeAny> implements PipeTransform {
  constructor(
    private readonly schema: T,
    private readonly opts: ZodValidationPipeOptions = {},
  ) {}

  transform(value: unknown): unknown {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        error: this.opts.errorMessage ?? "Validation failed",
        issues: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }
}
