import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiFetch } from "@/lib/api";

type ExecutionStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED";

interface Execution {
  id: number;
  status: ExecutionStatus;

  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;

  exitCode: number | null;
  hasLog: boolean;

  playbook: {
    id: number;
    name: string;
  };

  executedBy: {
    id: number;
    email: string;
  };
}

interface HistoryResponse {
  executions: Execution[];
}

const isFinished = (status: ExecutionStatus) =>
  status === "SUCCESS" || status === "FAILED" || status === "CANCELLED";

export default function HistoryView() {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Log dialog
  const [logExecution, setLogExecution] = useState<Execution | null>(null);
  const [logText, setLogText] = useState<string | null>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  const loadExecutions = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const response = await apiFetch("/executions");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg ?? "Failed to load execution history");
      }

      setExecutions((data as HistoryResponse).executions);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load execution history"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadExecutions();
  }, [loadExecutions]);

  // Fetch the log whenever a different execution is selected
  useEffect(() => {
    if (!logExecution) {
      return;
    }

    let cancelled = false;

    const loadLog = async () => {
      setLogLoading(true);
      setLogError(null);
      setLogText(null);

      try {
        const response = await apiFetch(`/executions/${logExecution.id}/log`);

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.msg ?? "Failed to load log");
        }

        const text = await response.text();

        if (!cancelled) {
          setLogText(text);
        }
      } catch (error) {
        if (!cancelled) {
          setLogError(
            error instanceof Error ? error.message : "Failed to load log"
          );
        }
      } finally {
        if (!cancelled) {
          setLogLoading(false);
        }
      }
    };

    loadLog();

    return () => {
      cancelled = true;
    };
  }, [logExecution]);

  const formatDate = (date: string | null) => {
    if (!date) {
      return "-";
    }

    return new Date(date).toLocaleString();
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Execution history</CardTitle>

            <CardDescription>
              View queued, running and completed playbook executions.
            </CardDescription>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadExecutions(true)}
            disabled={refreshing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />

            Refresh
          </Button>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />

              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />

              Loading execution history...
            </div>
          ) : executions.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No playbook executions yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Execution</TableHead>
                    <TableHead>Playbook</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Executed by</TableHead>
                    {/* <TableHead>Queued at</TableHead> */}
                    <TableHead>Started at</TableHead>
                    <TableHead>Finished at</TableHead>
                    {/* <TableHead>Exit code</TableHead> */}
                    <TableHead>Log</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {executions.map((execution) => (
                    <TableRow key={execution.id}>
                      <TableCell className="font-medium">
                        #{execution.id}
                      </TableCell>

                      <TableCell>{execution.playbook.name}</TableCell>

                      <TableCell>
                        <StatusBadge status={execution.status} />
                      </TableCell>

                      <TableCell>{execution.executedBy.email}</TableCell>

                      {/* <TableCell>{formatDate(execution.createdAt)}</TableCell> */}

                      <TableCell>{formatDate(execution.startedAt)}</TableCell>

                      <TableCell>{formatDate(execution.finishedAt)}</TableCell>

                      {/* <TableCell>{execution.exitCode ?? "-"}</TableCell> */}

                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            !isFinished(execution.status) || !execution.hasLog
                          }
                          onClick={() => setLogExecution(execution)}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Log
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log dialog */}

      <Dialog
        open={logExecution !== null}
        onOpenChange={(open) => {
          if (!open) {
            setLogExecution(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Execution #{logExecution?.id} log
            </DialogTitle>

            <DialogDescription className="flex items-center gap-2">
              {logExecution?.playbook.name}

              {logExecution && <StatusBadge status={logExecution.status} />}
            </DialogDescription>
          </DialogHeader>

          {logLoading && (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />

              Loading log...
            </div>
          )}

          {logError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />

              <AlertDescription>{logError}</AlertDescription>
            </Alert>
          )}

          {logText !== null && (
            <pre className="max-h-[60vh] overflow-auto whitespace-pre rounded-md bg-zinc-950 p-4 font-mono text-xs text-zinc-100">
              {logText}
            </pre>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusBadge({ status }: { status: ExecutionStatus }) {
  switch (status) {
    case "QUEUED":
      return (
        <Badge variant="secondary">
          <Clock3 className="mr-1 h-3 w-3" />
          Queued
        </Badge>
      );

    case "RUNNING":
      return (
        <Badge variant="outline">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          Running
        </Badge>
      );

    case "SUCCESS":
      return (
        <Badge className="bg-green-600 text-white">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Success
        </Badge>
      );

    case "FAILED":
      return (
        <Badge variant="destructive">
          <XCircle className="mr-1 h-3 w-3" />
          Failed
        </Badge>
      );

    case "CANCELLED":
      return <Badge variant="secondary">Cancelled</Badge>;
  }
}