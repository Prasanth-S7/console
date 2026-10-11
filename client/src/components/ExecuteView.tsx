import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Loader2,
  Play,
  Plus,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

interface Playbook {
  id: number;
  name: string;
  description: string | null;
  path: string;
}

type OptionType =
  | "path"
  | "string"
  | "list"
  | "boolean"
  | "number"
  | "count";

interface OptionDef {
  key: string;
  flag: string;
  label: string;
  description: string;
  type: OptionType;
  placeholder?: string;
  min?: number;
  max?: number;
}

type OptionValue = string | string[] | number | boolean;

interface ArgRow {
  id: string;
  key: string;
  value: string;
}

interface OptionRow {
  key: string;
  value: string;
}

interface RunResponse {
  msg: string;
  executionId: number;
  status: "QUEUED";
}

const newRow = (): ArgRow => ({
  id: crypto.randomUUID(),
  key: "",
  value: "",
});

export default function ExecuteView() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [selected, setSelected] = useState<Playbook | null>(null);
  const [open, setOpen] = useState(false);

  const [optionDefs, setOptionDefs] = useState<OptionDef[]>([]);
  const [optionRows, setOptionRows] = useState<OptionRow[]>([]);
  const [optionPickerOpen, setOptionPickerOpen] = useState(false);

  const [args, setArgs] = useState<ArgRow[]>([newRow()]);

  const [listLoading, setListLoading] = useState(true);
  const [queueing, setQueueing] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [queuedExecution, setQueuedExecution] =
    useState<number | null>(null);

  const defMap = useMemo(
    () => new Map(optionDefs.map((def) => [def.key, def])),
    [optionDefs]
  );

  const availableDefs = optionDefs.filter(
    (def) => !optionRows.some((row) => row.key === def.key)
  );

  // ------------------------------------------------------------
  // Load playbooks and the available options
  // ------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [playbookRes, optionRes] = await Promise.all([
          apiFetch("/playbooks"),
          apiFetch("/run/options"),
        ]);

        const playbookData = await playbookRes.json();
        const optionData = await optionRes.json();

        if (!playbookRes.ok) {
          throw new Error(playbookData.msg ?? "Failed to load playbooks");
        }

        if (!optionRes.ok) {
          throw new Error(optionData.msg ?? "Failed to load options");
        }

        if (cancelled) {
          return;
        }

        setPlaybooks(playbookData.playbooks);

        const defs = optionData.options as OptionDef[];

        setOptionDefs(defs);

        // Start with the inventory row, since it's the most common one
        if (defs.some((def) => def.key === "inventory")) {
          setOptionRows((rows) =>
            rows.length ? rows : [{ key: "inventory", value: "" }]
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load data"
          );
        }
      } finally {
        if (!cancelled) {
          setListLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  // ------------------------------------------------------------
  // Argument rows (extra vars)
  // ------------------------------------------------------------

  const updateRow = (id: string, field: "key" | "value", val: string) => {
    setArgs((rows) =>
      rows.map((row) => {
        if (row.id !== id) {
          return row;
        }

        if (field === "key") {
          return { ...row, key: val };
        }

        return { ...row, value: val };
      })
    );
  };

  const removeRow = (id: string) => {
    setArgs((rows) => {
      if (rows.length === 1) {
        return [newRow()];
      }

      return rows.filter((row) => row.id !== id);
    });
  };

  // ------------------------------------------------------------
  // Option rows
  // ------------------------------------------------------------

  const addOption = (key: string) => {
    const def = defMap.get(key);

    setOptionRows((rows) => [
      ...rows,
      { key, value: def?.type === "boolean" ? "true" : "" },
    ]);
  };

  const removeOption = (key: string) => {
    setOptionRows((rows) => rows.filter((row) => row.key !== key));
  };

  const updateOption = (key: string, value: string) => {
    setOptionRows((rows) =>
      rows.map((row) => (row.key === key ? { ...row, value } : row))
    );
  };

  /**
   * Converts the form rows into the payload the backend expects.
   * Blank options are skipped. Returns an error message if a value is
   * obviously wrong; the backend validates everything again.
   */
  const buildOptionsPayload = ():
    | { ok: true; payload: Record<string, OptionValue> }
    | { ok: false; error: string } => {
    const payload: Record<string, OptionValue> = {};

    for (const row of optionRows) {
      const def = defMap.get(row.key);

      if (!def) {
        continue;
      }

      const raw = row.value.trim();

      switch (def.type) {
        case "boolean":
          payload[def.key] = true;
          break;

        case "number":
        case "count": {
          if (!raw) {
            break;
          }

          const num = Number(raw);

          if (!Number.isInteger(num)) {
            return { ok: false, error: `${def.label}: must be a whole number` };
          }

          payload[def.key] = num;
          break;
        }

        case "list": {
          const items = raw
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);

          if (items.length) {
            payload[def.key] = items;
          }

          break;
        }

        case "path":
          if (raw && !raw.startsWith("/")) {
            return {
              ok: false,
              error: `${def.label}: must be an absolute path (start with /)`,
            };
          }

          if (raw) {
            payload[def.key] = raw;
          }

          break;

        default:
          if (raw) {
            payload[def.key] = raw;
          }
      }
    }

    return { ok: true, payload };
  };

  // ------------------------------------------------------------
  // Queue playbook
  // ------------------------------------------------------------

  const handleRun = async () => {
    if (!selected) {
      return;
    }

    const options = buildOptionsPayload();

    if (!options.ok) {
      setError(options.error);
      return;
    }

    setError(null);
    setQueuedExecution(null);
    setQueueing(true);

    const argsPayload: Record<string, string[]> = {};

    for (const row of args) {
      const key = row.key.trim();

      if (!key) {
        continue;
      }

      argsPayload[key] = row.value
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    }

    try {
      const res = await apiFetch("/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playbook_id: selected.id,
          options: options.payload,
          arguments: argsPayload,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.msg ?? "Failed to queue playbook");
        return;
      }

      const result = data as RunResponse;

      setQueuedExecution(result.executionId);

      // Keep the playbook and options, clear only the arguments
      setArgs([newRow()]);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setQueueing(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ------------------------------------------------------
          Left column: playbook + options
      ------------------------------------------------------- */}

      <div className="grid content-start gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Playbook</CardTitle>

            <CardDescription>
              Search and select the playbook to run.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label>Select playbook</Label>

              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={listLoading}
                    className="w-full justify-between font-normal"
                  >
                    {listLoading ? (
                      <span className="flex items-center text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading playbooks...
                      </span>
                    ) : selected ? (
                      selected.name
                    ) : (
                      <span className="text-muted-foreground">
                        Select a playbook...
                      </span>
                    )}

                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent
                  className="w-(--radix-popover-trigger-width) p-0"
                  align="start"
                >
                  <Command>
                    <CommandInput placeholder="Search playbooks..." />

                    <CommandList>
                      <CommandEmpty>No playbook found.</CommandEmpty>

                      <CommandGroup>
                        {playbooks.map((playbook) => (
                          <CommandItem
                            key={playbook.id}
                            value={playbook.name}
                            onSelect={() => {
                              setSelected(playbook);
                              setQueuedExecution(null);
                              setError(null);
                              setOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selected?.id === playbook.id
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            {playbook.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {selected && (
              <div className="grid gap-3 rounded-md border bg-muted/40 p-4 text-sm">
                {selected.description && (
                  <div>
                    <p className="font-medium">Description</p>

                    <p className="text-muted-foreground">
                      {selected.description}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Options */}

        <Card>
          <CardHeader>
            <CardTitle>Options</CardTitle>

            <CardDescription>
              Ansible command-line options for this run. Options left blank
              are ignored.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4">
            {optionRows.length === 0 && !listLoading && (
              <p className="text-sm text-muted-foreground">
                No options added. Ansible uses its defaults.
              </p>
            )}

            {optionRows.map((row) => {
              const def = defMap.get(row.key);

              if (!def) {
                return null;
              }

              return (
                <div key={row.key} className="grid gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor={`opt-${def.key}`}>
                      {def.label}{" "}
                      <span className="font-mono text-xs font-normal text-muted-foreground">
                        {def.flag}
                      </span>
                    </Label>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${def.label}`}
                      onClick={() => removeOption(def.key)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {def.type !== "boolean" && (
                    <Input
                      id={`opt-${def.key}`}
                      type={
                        def.type === "number" || def.type === "count"
                          ? "number"
                          : "text"
                      }
                      min={def.min}
                      max={def.max}
                      placeholder={def.placeholder}
                      value={row.value}
                      onChange={(e) =>
                        updateOption(def.key, e.target.value)
                      }
                      className={cn(
                        (def.type === "path" || def.type === "list") &&
                          "font-mono text-sm"
                      )}
                    />
                  )}

                  <p className="text-xs text-muted-foreground">
                    {def.description}
                  </p>
                </div>
              );
            })}

            <Popover
              open={optionPickerOpen}
              onOpenChange={setOptionPickerOpen}
            >
              <PopoverTrigger>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  disabled={availableDefs.length === 0}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add option
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-72 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search options..." />

                  <CommandList>
                    <CommandEmpty>No option found.</CommandEmpty>

                    <CommandGroup>
                      {availableDefs.map((def) => (
                        <CommandItem
                          key={def.key}
                          value={`${def.label} ${def.flag}`}
                          onSelect={() => {
                            addOption(def.key);
                            setOptionPickerOpen(false);
                          }}
                        >
                          <div className="grid">
                            <span>{def.label}</span>

                            <span className="font-mono text-xs text-muted-foreground">
                              {def.flag}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------------------
          Right column: extra arguments
      ------------------------------------------------------- */}

      <Card className="content-start">
        <CardHeader>
          <CardTitle>Extra arguments</CardTitle>

          <CardDescription>
            Passed to the playbook as extra vars. Separate multiple values
            with commas.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4">
          {args.map((row, index) => (
            <div key={row.id} className="flex items-end gap-2">
              <div className="grid flex-1 gap-2">
                {index === 0 && <Label>Name</Label>}

                <Input
                  placeholder="servers"
                  value={row.key}
                  onChange={(e) =>
                    updateRow(row.id, "key", e.target.value)
                  }
                />
              </div>

              <div className="grid flex-[2] gap-2">
                {index === 0 && <Label>Value(s)</Label>}

                <Input
                  placeholder="server1, server2"
                  value={row.value}
                  onChange={(e) =>
                    updateRow(row.id, "value", e.target.value)
                  }
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove argument"
                onClick={() => removeRow(row.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="w-full flex justify-end items-center">

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => setArgs((rows) => [...rows, newRow()])}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add argument
          </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />

              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {queuedExecution !== null && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />

              <AlertDescription>
                Playbook queued successfully. Execution #{queuedExecution}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter>
          <Button onClick={handleRun} disabled={!selected || queueing} className="w-full py-5">
            {queueing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}

            {queueing ? "Queueing..." : "Run playbook"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}