"use client";

import { useCallback, useId, useMemo, useState, type ComponentProps, type FormEvent, type Ref } from "react";
import { FormProvider, get, useForm, useFormContext, type FieldError } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApiError } from "@/lib/client";

type Values = Record<string, unknown>;
type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
export type FormSubmission = { form: HTMLFormElement; values: Values; submitter: HTMLElement | null };
export type ReportFields = (error: unknown) => boolean;

function controls(form: HTMLFormElement | null): Control[] {
  return Array.from(form?.elements ?? []).filter((el): el is Control =>
    el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement);
}

// El esquema se construye con los campos visibles en este envío, incluidos los de filas dinámicas.
function inputSchema(field: Control) {
  let text = z.string();
  if (field.required) text = text.min(1, "Completá este campo.");
  const min = field.getAttribute("minlength");
  const max = field.getAttribute("maxlength");
  if (min) text = text.min(Number(min), `Escribí al menos ${min} caracteres.`);
  if (max) text = text.max(Number(max), `El máximo permitido es de ${max} caracteres.`);
  return field.type === "email" ? text.pipe(z.email({ pattern: z.regexes.html5Email, error: "Ingresá un email con el formato nombre@dominio.com." })) : text;
}

function fieldMessage(field: Control, value: unknown) {
  if (field.validity.badInput) return "Ingresá un valor válido.";
  if (field.type === "checkbox" || field.type === "radio") {
    if (field.required && !value) return "Marcá esta opción para continuar.";
  } else if (typeof value === "string" && (value || field.required)) {
    const result = inputSchema(field).safeParse(value);
    if (!result.success) return result.error.issues[0].message;
  }
  if (field.validity.valueMissing) return "Completá este campo.";
  if (field.validity.rangeUnderflow) return `El mínimo permitido es ${field.getAttribute("min")}.`;
  if (field.validity.rangeOverflow) return `El máximo permitido es ${field.getAttribute("max")}.`;
  if (field.validity.patternMismatch) return field.title || "Revisá el formato de este dato.";
  if (field.validity.stepMismatch) return `Ingresá un valor en incrementos de ${field.getAttribute("step") || "1"}.`;
  return field.validity.valid ? undefined : field.validationMessage;
}

function issuesFrom(error: unknown): unknown[] {
  const details = error instanceof ApiError ? error.details : error;
  if (Array.isArray(details)) return details;
  if (!details || typeof details !== "object") return [];
  if ("campos" in details && Array.isArray(details.campos)) return details.campos;
  if ("campo" in details && error instanceof ApiError) return [{ campo: details.campo, mensaje: error.message }];
  return [];
}

type FormProps = Omit<ComponentProps<"form">, "onSubmit"> & {
  schema?: z.ZodType<Values>;
  shouldFocusError?: boolean;
  onSubmit?: (submission: FormSubmission, report: ReportFields) => unknown;
};

export function ValidatedForm({ onSubmit, children, schema, shouldFocusError = true, ...props }: FormProps) {
  const [element, setElement] = useState<HTMLFormElement | null>(null);
  const base = useMemo(() => z.record(z.string(), z.unknown()).transform((values, ctx) => {
    for (const field of controls(element)) {
      if (!field.willValidate || !field.name) continue;
      const message = fieldMessage(field, get(values, field.name));
      if (message) ctx.addIssue({ code: "custom", path: field.name.split("."), message });
    }
    if (schema) {
      const parsed = schema.safeParse(values);
      if (parsed.success) return parsed.data;
      for (const issue of parsed.error.issues) {
        ctx.addIssue({ code: "custom", path: issue.path.length ? issue.path : ["root", "server"], message: issue.message });
      }
    }
    return values;
  }), [element, schema]);
  const methods = useForm<Values>({ resolver: zodResolver(base), shouldUnregister: true, shouldFocusError });
  const { errors } = methods.formState;
  const general = errors.root?.server?.message;

  function submit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const fields = controls(form);
    // Los atajos de la interfaz y el autocompletado también pueden cambiar el valor sin un evento change.
    for (const field of fields) {
      if (!field.name || field.disabled || ["file", "checkbox", "radio", "select-multiple"].includes(field.type)) continue;
      if (methods.getValues(field.name) !== field.value) methods.setValue(field.name, field.value);
    }
    function report(error: unknown) {
      let first: Control | undefined;
      const others: string[] = [];
      for (const issue of issuesFrom(error)) {
        if (!issue || typeof issue !== "object") continue;
        const path = "path" in issue && Array.isArray(issue.path) ? issue.path.join(".") : undefined;
        const key = "campo" in issue ? issue.campo : path;
        const message = "mensaje" in issue ? issue.mensaje : "message" in issue ? issue.message : null;
        if (typeof message !== "string") continue;
        const field = fields.find(f => f.name === key);
        if (field) {
          methods.setError(field.name, { type: "server", message });
          first ??= field;
        } else others.push(message);
      }
      if (first) {
        const field = first;
        requestAnimationFrame(() => field.focus());
      }
      if (others.length) methods.setError("root.server", { type: "server", message: others.join(" ") });
      return Boolean(first || others.length);
    }
    return methods.handleSubmit(async values => {
      if (onSubmit) await onSubmit({ form, values, submitter }, report);
      else HTMLFormElement.prototype.submit.call(form);
    })(event);
  }

  return <FormProvider {...methods}>
    <form method="post" {...props} ref={setElement} noValidate onSubmit={submit}>
      {general && <div className="note note-danger" role="alert">{general}</div>}
      {children}
    </form>
  </FormProvider>;
}

function forwardNode<T>(ref: Ref<T> | undefined, node: T | null) {
  if (typeof ref === "function") return ref(node);
  if (ref) ref.current = node;
}

function useField<T extends Control>(props: {
  id?: string; name?: string; ref?: Ref<T>; onChange?: React.ChangeEventHandler<T>; onBlur?: React.FocusEventHandler<T>;
  "aria-describedby"?: string; "aria-invalid"?: ComponentProps<"input">["aria-invalid"];
}) {
  const id = useId();
  const name = props.name || props.id || id;
  const { register, formState: { errors } } = useFormContext();
  const registered = register(name);
  const forwarded = props.ref;
  const ref = useCallback((node: T | null) => {
    register(name).ref(node);
    return forwardNode(forwarded, node);
  }, [register, name, forwarded]);
  const message = (get(errors, name) as FieldError | undefined)?.message;
  const description = id + "-error";
  return {
    attrs: { name, id: props.id || id, ref,
      onChange: (event: React.ChangeEvent<T>) => { void registered.onChange(event); props.onChange?.(event); },
      onBlur: (event: React.FocusEvent<T>) => { void registered.onBlur(event); props.onBlur?.(event); },
      "aria-invalid": message ? true : props["aria-invalid"],
      "aria-describedby": [props["aria-describedby"], message && description].filter(Boolean).join(" ") || undefined },
    hint: message && <small aria-hidden="true" id={description} className="field-error">{message}</small>,
  };
}

export function Input(props: ComponentProps<"input">) {
  const { attrs, hint } = useField<HTMLInputElement>(props);
  return <><input {...props} {...attrs} />{hint}</>;
}

export function Select(props: ComponentProps<"select">) {
  const { attrs, hint } = useField<HTMLSelectElement>(props);
  return <><select {...props} {...attrs} />{hint}</>;
}

export function Textarea(props: ComponentProps<"textarea">) {
  const { attrs, hint } = useField<HTMLTextAreaElement>(props);
  return <><textarea {...props} {...attrs} />{hint}</>;
}
