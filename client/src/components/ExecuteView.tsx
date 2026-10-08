import { useEffect, useState } from "react";
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

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

interface Playbook {
  id: number;
  name: string;
  description: string | null;
  path: string;
}

interface ArgRow {
  id: string;
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

  const [args, setArgs] = useState<ArgRow[]>([
    newRow(),
  ]);

  const [listLoading, setListLoading] = useState(true);
  const [queueing, setQueueing] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [queuedExecution, setQueuedExecution] =
    useState<number | null>(null);

  // ------------------------------------------------------------
  // Load playbooks
  // ------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    const loadPlaybooks = async () => {
      try {
        const res = await fetch(`${API_URL}/playbooks`, {
          credentials: "include",
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            data.msg ?? "Failed to load playbooks"
          );
        }

        if (!cancelled) {
          setPlaybooks(data.playbooks);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load playbooks"
          );
        }
      } finally {
        if (!cancelled) {
          setListLoading(false);
        }
      }
    };

    loadPlaybooks();

    return () => {
      cancelled = true;
    };
  }, []);

  // ------------------------------------------------------------
  // Update argument row
  // ------------------------------------------------------------

  const updateRow = (
    id: string,
    field: "key" | "value",
    val: string
  ) => {
    setArgs((rows) =>
      rows.map((row) => {
        if (row.id !== id) {
          return row;
        }

        if (field === "key") {
          return {
            ...row,
            key: val,
          };
        }

        return {
          ...row,
          value: val,
        };
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

  const handleRun = async () => {
    if (!selected) {
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
      const res = await fetch(`${API_URL}/run`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        credentials: "include",

        body: JSON.stringify({
          playbook_id: selected.id,
          arguments: argsPayload,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(
          data.msg ?? "Failed to queue playbook"
        );

        return;
      }

      const result = data as RunResponse;

      setQueuedExecution(result.executionId);

      setArgs([newRow()]);
    } catch {
      setError(
        "Could not reach the server. Please try again."
      );
    } finally {
      setQueueing(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">

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

            <Popover
              open={open}
              onOpenChange={setOpen}
            >

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

                    <CommandEmpty>
                      No playbook found.
                    </CommandEmpty>

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
                  <p className="font-medium">
                    Description
                  </p>
                  <p className="text-muted-foreground">
                    {selected.description}
                  </p>
                </div>
              )}
              <div>
                <p className="font-medium">
                  Path
                </p>
                <p className="break-all font-mono text-xs text-muted-foreground">
                  {selected.path}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            Extra arguments
          </CardTitle>
          <CardDescription>
            Passed to the playbook as extra vars.
            Separate multiple values with commas.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {args.map((row, index) => (
            <div
              key={row.id}
              className="flex items-end gap-2"
            >
              <div className="grid flex-1 gap-2">
                {index === 0 && (
                  <Label>
                    Name
                  </Label>
                )}
                <Input
                  placeholder="hosts"
                  value={row.key}
                  onChange={(e) =>
                    updateRow(
                      row.id,
                      "key",
                      e.target.value
                    )
                  }
                />
              </div>
              <div className="grid flex-[2] gap-2">
                {index === 0 && (
                  <Label>
                    Value(s)
                  </Label>
                )}
                <Input
                  placeholder="server1, server2"
                  value={row.value}
                  onChange={(e) =>
                    updateRow(
                      row.id,
                      "value",
                      e.target.value
                    )
                  }
                />

              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove argument"
                onClick={() =>
                  removeRow(row.id)
                }
              >
                <X className="h-4 w-4" />
              </Button>

            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() =>
              setArgs((rows) => [
                ...rows,
                newRow(),
              ])
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add argument
          </Button>

          {error && (
            <Alert variant="destructive">

              <AlertCircle className="h-4 w-4" />

              <AlertDescription>
                {error}
              </AlertDescription>
            </Alert>
          )}
          {queuedExecution !== null && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Playbook queued successfully.
                {" "}
                Execution #{queuedExecution}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleRun}
            disabled={!selected || queueing}
          >
            {queueing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            {queueing
              ? "Queueing..."
              : "Run playbook"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}