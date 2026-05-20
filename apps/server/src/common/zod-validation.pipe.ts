import { BadRequestException, PipeTransform } from "@nestjs/common";
import type { ZodTypeAny } from "zod";

export class ZodValidationPipe<T extends ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): unknown {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        ok: false,
        error: {
          code: "BAD_REQUEST",
          message: "Validation failed",
          issues: parsed.error.flatten(),
        },
      });
    }
    return parsed.data;
  }
}
