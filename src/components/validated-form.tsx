"use client";

import { createContext, useContext, useId, useState, type ComponentProps, type FormEvent } from "react";
import { ApiError } from "@/lib/client";

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type Messages = Record<string, string>;
const FieldMessages = createContext<Messages>({});

function isControl(element: Element): element is Control {
  return element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement;
}

function constraintMessage(field: Control) {
  const v = field.validity;
  if (v.badInput) return "Ingresá un valor válido.";
  if (v.valueMissing) return field.type === "checkbox" ? "Marcá esta opción para continuar." : "Completá este campo.";
  if (v.typeMismatch && field.type === "email") return "Ingresá un email con el formato nombre@dominio.com.";
  if (v.tooShort) return `Escribí al menos ${field.getAttribute("minlength")} caracteres.`;
  if (v.rangeUnderflow) return `El mínimo permitido es ${field.getAttribute("min")}.`;
  if (v.rangeOverflow) return `El máximo permitido es ${field.getAttribute("max")}.`;
  if (v.patternMismatch) return field.title || "Revisá el formato de este dato.";
  return field.validationMessage;
}

export type ReportFields = (error: unknown) => boolean;

function issuesFrom(error: unknown): unknown[] {
  const details = error instanceof ApiError ? error.details : error;
  if (Array.isArray(details)) return details;
  if (!details || typeof details !== "object") return [];
  if ("campos" in details && Array.isArray(details.campos)) return details.campos;
  if ("campo" in details && error instanceof ApiError) return [{ campo: details.campo, mensaje: error.message }];
  return [];
}

type FormProps = Omit<ComponentProps<"form">, "onSubmit"> & {
  customSummary?: boolean;
  onSubmit?: (event: FormEvent<HTMLFormElement>, report: ReportFields) => unknown;
};

export function ValidatedForm({ onSubmit, children, onChange, customSummary, ...props }: FormProps) {
  const [errors, setErrors] = useState<Messages>({});
  const [general, setGeneral] = useState("");
  const count = Object.keys(errors).length;

  function submit(event: FormEvent<HTMLFormElement>) {
    const controls = Array.from(event.currentTarget.elements).filter(isControl);
    const names = new Set(controls.map(field => field.name || field.id));

    function show(messages: Messages) {
      setErrors(messages);
      const first = controls.find(field => Object.hasOwn(messages, field.name || field.id));
      if (first) requestAnimationFrame(() => first.focus());
    }

    function report(error: unknown) {
      const messages: Messages = {};
      const others: string[] = [];
      for (const issue of issuesFrom(error)) {
        if (!issue || typeof issue !== "object") continue;
        const path = "path" in issue && Array.isArray(issue.path) ? issue.path.join(".") : undefined;
        const key = "campo" in issue ? issue.campo : path;
        const message = "mensaje" in issue ? issue.mensaje : "message" in issue ? issue.message : null;
        if (typeof message !== "string") continue;
        if (typeof key === "string" && names.has(key)) messages[key] ??= message;
        else others.push(message);
      }
      if (!Object.keys(messages).length && !others.length) return false;
      show(messages);
      setGeneral(others.join(" "));
      return true;
    }

    const invalid: Messages = {};
    for (const field of controls) {
      if (field.willValidate && !field.validity.valid) invalid[field.name || field.id] = constraintMessage(field);
    }
    setGeneral("");
    show(invalid);
    if (Object.keys(invalid).length) {
      event.preventDefault();
      return;
    }
    if (onSubmit) {
      event.preventDefault();
      onSubmit(event, report);
    }
  }

  return (
    <FieldMessages.Provider value={errors}>
      <form method="post" {...props} noValidate onSubmit={submit} onChange={event => {
        onChange?.(event);
        const field = event.target;
        if (!isControl(field)) return;
        const key = field.name || field.id;
        if (!Object.hasOwn(errors, key)) return;
        const remaining = { ...errors };
        if (field.willValidate && !field.validity.valid) remaining[key] = constraintMessage(field);
        else delete remaining[key];
        setErrors(remaining);
      }}>
        {((count > 0 && !customSummary) || general) && (
          <div className="note note-danger" role="alert">
            {count > 0 && !customSummary && `Hay datos que corregir. Revisá ${count === 1 ? "el campo señalado" : `los ${count} campos señalados`} antes de continuar. `}
            {general}
          </div>
        )}
        {children}
      </form>
    </FieldMessages.Provider>
  );
}

export function FieldErrorSummary({ labels }: { labels: Record<string, string> }) {
  const entries = Object.entries(useContext(FieldMessages));
  if (!entries.length) return null;
  return (
    <div className="note note-danger" role="alert">
      <div>
        <strong>{entries.length === 1 ? "Hay un campo que impide continuar." : `Hay ${entries.length} campos que impiden continuar.`}</strong>
        <ul>
          {entries.map(([name, message]) => <li key={name}><b>{labels[name] ?? name}</b> — {message}</li>)}
        </ul>
      </div>
    </div>
  );
}

function useField(props: { id?: string; name?: string; "aria-describedby"?: string; "aria-invalid"?: ComponentProps<"input">["aria-invalid"] }) {
  const id = useId();
  const message = useContext(FieldMessages)[props.name || props.id || id];
  const description = id + "-error";
  return {
    attrs: { id: props.id || id, "aria-invalid": message ? true : props["aria-invalid"],
      "aria-describedby": [props["aria-describedby"], message && description].filter(Boolean).join(" ") || undefined },
    hint: message && <small aria-hidden="true" id={description} className="field-error">{message}</small>,
  };
}

export function Input(props: ComponentProps<"input">) {
  const { attrs, hint } = useField(props);
  return <><input {...props} {...attrs} />{hint}</>;
}

export function Select(props: ComponentProps<"select">) {
  const { attrs, hint } = useField(props);
  return <><select {...props} {...attrs} />{hint}</>;
}

export function Textarea(props: ComponentProps<"textarea">) {
  const { attrs, hint } = useField(props);
  return <><textarea {...props} {...attrs} />{hint}</>;
}
