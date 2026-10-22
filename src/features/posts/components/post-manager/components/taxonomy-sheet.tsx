import { ORPCError } from "@orpc/client";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import { ActionMenu } from "@/components/ui/action-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/page-heading";
import { SearchField } from "@/components/ui/search-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusText } from "@/components/ui/status-text";
import { categoriesAdminQueryOptions } from "@/features/categories/queries";
import { tagsWithCountAdminQueryOptions } from "@/features/tags/queries";
import { orpc, orpcClient } from "@/lib/orpc";
import { m } from "@/paraglide/messages";
import "./taxonomy-sheet.css";

export type TaxonomyKind = "category" | "tag";
export type TaxonomyItem = { id: number; name: string; postCount: number };

/** The same 50-character limit the create and update inputs enforce. */
const NAME_MAX_LENGTH = 50;

/** Items whose name contains the query, ignoring case. */
export function filterTaxonomy(items: Array<TaxonomyItem>, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((item) => item.name.toLowerCase().includes(needle));
}

/**
 * The trimmed query when Enter would create it: it is not empty and no
 * existing name equals it, ignoring case, as the editor's tag picker decides.
 */
export function nameToCreate(items: Array<TaxonomyItem>, query: string) {
  const name = query.trim();
  if (!name) return null;
  const lower = name.toLowerCase();
  return items.some((item) => item.name.toLowerCase() === lower) ? null : name;
}

const api = {
  category: {
    create: (name: string) => orpcClient.categories.admin.create({ name }),
    rename: (id: number, name: string) =>
      orpcClient.categories.admin.update({ id, data: { name } }),
    remove: (id: number) => orpcClient.categories.admin.remove({ id }),
  },
  tag: {
    create: (name: string) => orpcClient.tags.admin.create({ name }),
    rename: (id: number, name: string) =>
      orpcClient.tags.admin.update({ id, data: { name } }),
    remove: (id: number) => orpcClient.tags.admin.remove({ id }),
  },
} satisfies Record<TaxonomyKind, unknown>;

/**
 * Refresh what shows categories or tags: the counts here, the post list's
 * filters, the editor's pickers, and the post lists themselves.
 */
function invalidate(queryClient: QueryClient, kind: TaxonomyKind) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: kind === "category" ? orpc.categories.key() : orpc.tags.key(),
    }),
    queryClient.invalidateQueries({ queryKey: orpc.posts.list.key() }),
    queryClient.invalidateQueries({ queryKey: orpc.posts.admin.list.key() }),
  ]);
}

function errorMessage(kind: TaxonomyKind, error: unknown) {
  if (error instanceof ORPCError && error.defined) {
    switch (error.code) {
      case "CATEGORY_NAME_ALREADY_EXISTS":
        return m.category_manager_name_exists();
      case "CATEGORY_NOT_FOUND":
        return m.category_manager_not_found();
      case "TAG_NAME_ALREADY_EXISTS":
        return m.tag_manager_name_exists();
      case "TAG_NOT_FOUND":
        return m.tag_manager_not_found();
    }
  }
  return kind === "category"
    ? m.category_manager_unknown_error()
    : m.tag_manager_unknown_error();
}

const rowId = (kind: TaxonomyKind, id: number) => `taxonomy-row-${kind}-${id}`;

/**
 * Categories and tags in one sheet beside the post list: search them, create
 * one from the same field, rename or delete one, and pick one to filter the
 * list by.
 */
export function TaxonomySheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (kind: TaxonomyKind, id: number) => void;
}) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<TaxonomyKind>("category");
  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="lg"
      className="taxonomy-sheet"
      aria-labelledby={titleId}
      initialFocus={() => inputRef.current}
    >
      <div className="taxonomy-sheet-head">
        <SectionHeading
          size="sm"
          title={m.taxonomy_sheet_title()}
          titleProps={{ id: titleId }}
          actions={
            <IconButton size="md" label={m.common_close()} onClick={onClose}>
              <X size={18} />
            </IconButton>
          }
        />
        <SegmentedControl
          aria-label={m.taxonomy_sheet_title()}
          stretch
          value={kind}
          onValueChange={setKind}
          items={[
            { value: "category", label: m.category_manager_title() },
            { value: "tag", label: m.tag_manager_title() },
          ]}
        />
      </div>
      <TaxonomyPanel
        key={kind}
        kind={kind}
        inputRef={inputRef}
        onPick={(id) => onPick(kind, id)}
      />
    </Sheet>
  );
}

function useTaxonomyItems(kind: TaxonomyKind) {
  const categories = useQuery({
    ...categoriesAdminQueryOptions(),
    enabled: kind === "category",
    refetchOnMount: "always",
  });
  const tags = useQuery({
    ...tagsWithCountAdminQueryOptions(),
    enabled: kind === "tag",
    refetchOnMount: "always",
  });
  const query = kind === "category" ? categories : tags;
  const items: Array<TaxonomyItem> | undefined =
    kind === "category" ? categories.data?.items : tags.data;
  return {
    items,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  };
}

function TaxonomyPanel({
  kind,
  inputRef,
  onPick,
}: {
  kind: TaxonomyKind;
  inputRef: RefObject<HTMLInputElement | null>;
  onPick: (id: number) => void;
}) {
  const queryClient = useQueryClient();
  const createErrorId = useId();
  const { items, isPending, isError, refetch } = useTaxonomyItems(kind);
  const [query, setQuery] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TaxonomyItem | null>(null);
  const [toDelete, setToDelete] = useState<TaxonomyItem | null>(null);
  const deleteTrigger = useRef<HTMLElement | null>(null);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgeDone, setPurgeDone] = useState<number | null>(null);
  const purgeTrigger = useRef<HTMLButtonElement>(null);
  const [focusRow, setFocusRow] = useState<number | null>(null);

  useEffect(() => {
    if (focusRow === null) return;
    document.getElementById(rowId(kind, focusRow))?.focus();
    setFocusRow(null);
  }, [focusRow, kind]);

  const all = items ?? [];
  const visible = filterTaxonomy(all, query);
  const creatable = nameToCreate(all, query);
  const unused = kind === "tag" ? all.filter((item) => !item.postCount) : [];

  const createMutation = useMutation({
    mutationFn: (name: string) => api[kind].create(name),
    onSuccess: async (created) => {
      await invalidate(queryClient, kind);
      setQuery("");
      toast.success(
        kind === "category"
          ? m.taxonomy_sheet_category_created({ name: created.name })
          : m.taxonomy_sheet_tag_created({ name: created.name }),
      );
    },
    onError: (error) => setCreateError(errorMessage(kind, error)),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api[kind].remove(id),
    onSuccess: async () => {
      await invalidate(queryClient, kind);
      setToDelete(null);
      toast.success(
        kind === "category"
          ? m.category_manager_deleted()
          : m.tag_manager_deleted(),
      );
    },
    onError: (error) => toast.error(errorMessage(kind, error)),
  });
  const purgeMutation = useMutation({
    mutationFn: async (ids: Array<number>) => {
      let done = 0;
      let failed = 0;
      setPurgeDone(0);
      for (const id of ids) {
        try {
          await api.tag.remove(id);
          done += 1;
        } catch {
          failed += 1;
        }
        setPurgeDone(done + failed);
      }
      return { done, failed };
    },
    onSuccess: async ({ done, failed }) => {
      await invalidate(queryClient, "tag");
      setPurgeOpen(false);
      setPurgeDone(null);
      if (failed) toast.error(m.taxonomy_sheet_purge_partial({ done, failed }));
      else toast.success(m.taxonomy_sheet_purged({ count: done }));
    },
  });

  const create = () => {
    if (!creatable || createMutation.isPending) return;
    setCreateError(null);
    createMutation.mutate(creatable);
  };

  return (
    <>
      <div className="taxonomy-sheet-search">
        <SearchField
          ref={inputRef}
          aria-label={
            kind === "category"
              ? m.taxonomy_sheet_search_category()
              : m.taxonomy_sheet_search_tag()
          }
          placeholder={
            kind === "category"
              ? m.taxonomy_sheet_search_category()
              : m.taxonomy_sheet_search_tag()
          }
          value={query}
          maxLength={NAME_MAX_LENGTH}
          autoComplete="off"
          enterKeyHint="done"
          aria-invalid={createError ? true : undefined}
          aria-describedby={createError ? createErrorId : undefined}
          onValueChange={(value) => {
            setQuery(value);
            setCreateError(null);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            event.preventDefault();
            create();
          }}
          clearLabel={m.tag_manager_clear_search()}
        />
        {creatable && !isPending && !isError ? (
          <Button
            variant="plain"
            size="sm"
            className="w-full justify-start font-normal"
            icon={<Plus size={14} />}
            loading={createMutation.isPending}
            onClick={create}
          >
            <span className="truncate">
              {m.taxonomy_sheet_create_hint({ name: creatable })}
            </span>
          </Button>
        ) : null}
        {createError ? (
          <StatusText error id={createErrorId}>
            {createError}
          </StatusText>
        ) : null}
      </div>
      <div className="taxonomy-sheet-list custom-scrollbar">
        {isPending ? (
          <div className="taxonomy-sheet-loading" aria-busy="true">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-10 rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            size="compact"
            role="alert"
            description={m.taxonomy_sheet_load_error()}
            action={
              <Button variant="text" onClick={() => void refetch()}>
                {m.error_retry()}
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            size="compact"
            icon={Search}
            description={
              all.length && query.trim()
                ? m.taxonomy_sheet_no_match({ query: query.trim() })
                : kind === "category"
                  ? m.taxonomy_sheet_category_empty()
                  : m.taxonomy_sheet_tag_empty()
            }
          />
        ) : (
          <ul>
            {visible.map((item) =>
              editing?.id === item.id ? (
                <RenameRow
                  key={item.id}
                  kind={kind}
                  item={item}
                  onDone={() => {
                    setEditing(null);
                    setFocusRow(item.id);
                  }}
                />
              ) : (
                <li key={item.id} className="taxonomy-sheet-row">
                  <Button
                    id={rowId(kind, item.id)}
                    variant="plain"
                    className="min-w-0 flex-1 justify-between font-normal"
                    aria-label={m.taxonomy_sheet_pick({
                      name: item.name,
                      count: item.postCount,
                    })}
                    onClick={() => onPick(item.id)}
                  >
                    <span className="truncate">{item.name}</span>
                    <Badge size="sm">{item.postCount}</Badge>
                  </Button>
                  <ActionMenu
                    label={m.taxonomy_sheet_row_actions({ name: item.name })}
                    placement="bottom-end"
                    items={[
                      {
                        label: m.taxonomy_sheet_rename(),
                        icon: Pencil,
                        onSelect: () => setEditing(item),
                      },
                      {
                        label: m.category_manager_delete(),
                        icon: Trash2,
                        danger: true,
                        onSelect: (trigger) => {
                          deleteTrigger.current = trigger;
                          setToDelete(item);
                        },
                      },
                    ]}
                  />
                </li>
              ),
            )}
          </ul>
        )}
      </div>
      {unused.length > 0 ? (
        <footer className="taxonomy-sheet-footer">
          <Button
            ref={purgeTrigger}
            variant="plain"
            tone="danger"
            size="sm"
            icon={<Trash2 size={14} />}
            onClick={() => setPurgeOpen(true)}
          >
            {m.taxonomy_sheet_purge({ count: unused.length })}
          </Button>
        </footer>
      ) : null}
      <ConfirmationModal
        isOpen={toDelete !== null}
        title={
          kind === "category"
            ? m.category_manager_delete_title()
            : m.tag_manager_delete_title()
        }
        message={
          kind === "category"
            ? m.taxonomy_sheet_delete_category_desc({
                name: toDelete?.name ?? "",
                count: toDelete?.postCount ?? 0,
              })
            : m.taxonomy_sheet_delete_tag_desc({
                name: toDelete?.name ?? "",
                count: toDelete?.postCount ?? 0,
              })
        }
        confirmLabel={m.category_manager_delete()}
        isDanger
        isLoading={deleteMutation.isPending}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete && !deleteMutation.isPending)
            deleteMutation.mutate(toDelete.id);
        }}
        returnFocus={() =>
          deleteTrigger.current?.isConnected
            ? deleteTrigger.current
            : inputRef.current
        }
      />
      <ConfirmationModal
        isOpen={purgeOpen}
        title={m.taxonomy_sheet_purge_title()}
        message={m.taxonomy_sheet_purge_desc({ count: unused.length })}
        confirmLabel={m.category_manager_delete()}
        isDanger
        isLoading={purgeMutation.isPending}
        loadingLabel={m.taxonomy_sheet_purge_progress({
          done: purgeDone ?? 0,
          total: purgeMutation.variables?.length ?? unused.length,
        })}
        onClose={() => setPurgeOpen(false)}
        onConfirm={() => {
          if (!purgeMutation.isPending)
            purgeMutation.mutate(unused.map((item) => item.id));
        }}
        returnFocus={() =>
          purgeTrigger.current?.isConnected
            ? purgeTrigger.current
            : inputRef.current
        }
      />
    </>
  );
}

/** A row turned into its name field: Enter saves, Escape cancels. */
function RenameRow({
  kind,
  item,
  onDone,
}: {
  kind: TaxonomyKind;
  item: TaxonomyItem;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const errorId = useId();
  const hintId = useId();
  const [draft, setDraft] = useState(item.name);
  const [error, setError] = useState<string | null>(null);
  const renameMutation = useMutation({
    mutationFn: (name: string) => api[kind].rename(item.id, name),
    onSuccess: async () => {
      await invalidate(queryClient, kind);
      toast.success(
        kind === "category"
          ? m.category_manager_renamed()
          : m.tag_manager_renamed(),
      );
      onDone();
    },
    onError: (failure) => setError(errorMessage(kind, failure)),
  });
  const save = () => {
    const name = draft.trim();
    if (renameMutation.isPending) return;
    if (!name || name === item.name) onDone();
    else renameMutation.mutate(name);
  };
  return (
    <li className="taxonomy-sheet-rename">
      <Input
        autoFocus
        aria-label={m.taxonomy_sheet_rename_label({ name: item.name })}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hintId}
        value={draft}
        maxLength={NAME_MAX_LENGTH}
        autoComplete="off"
        enterKeyHint="done"
        readOnly={renameMutation.isPending}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          } else if (event.key === "Escape") {
            // Handled here, so the sheet stays open.
            event.preventDefault();
            if (!renameMutation.isPending) onDone();
          }
        }}
      />
      {error ? (
        <StatusText error id={errorId}>
          {error}
        </StatusText>
      ) : (
        <p id={hintId} className="taxonomy-sheet-hint">
          {renameMutation.isPending
            ? m.common_processing()
            : m.taxonomy_sheet_rename_hint()}
        </p>
      )}
    </li>
  );
}
