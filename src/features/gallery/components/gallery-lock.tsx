import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { orpc } from "@/lib/orpc";
import { m } from "@/paraglide/messages";

interface GalleryLockProps {
  categoryId: number;
}

export function GalleryLock({ categoryId }: GalleryLockProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!password || pending) return;

    setPending(true);
    setFailed(false);
    try {
      const response = await fetch("/api/gallery-unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ categoryId, password }),
      });
      if (!response.ok) {
        setFailed(true);
        return;
      }
      // cookie 已写入。失效相册列表，让列表页这条从锁卡片变真实标题，
      // 然后换到真实链接，不再整页刷新。
      const data = (await response.json()) as { slug?: string };
      await queryClient.invalidateQueries({
        queryKey: orpc.gallery.categories.list.key(),
      });
      if (data.slug) {
        await navigate({
          to: "/gallery/$category",
          params: { category: data.slug },
          replace: true,
        });
      } else {
        await navigate({ to: "/gallery", replace: true });
      }
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fuwari-card-base flex flex-col items-center gap-4 px-6 py-12 text-center fuwari-onload-animation">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/5 fuwari-text-50 dark:bg-white/10">
        <Lock size={22} strokeWidth={1.5} />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold fuwari-text-90">
          {m.gallery_locked_title()}
        </h2>
        <p className="text-sm fuwari-text-50">{m.gallery_locked_desc()}</p>
      </div>
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-2"
      >
        <PasswordInput
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={m.gallery_locked_placeholder()}
          autoFocus
          secret
        />
        <Button
          type="submit"
          variant="primary"
          loading={pending}
          disabled={pending || password.length === 0}
        >
          {pending ? m.gallery_locked_submitting() : m.gallery_locked_submit()}
        </Button>
        {failed && (
          <p className="text-sm text-(--fuwari-danger-fg)">
            {m.gallery_locked_error()}
          </p>
        )}
      </form>
    </div>
  );
}
