import { useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { orpc } from "@/lib/orpc";
import { m } from "@/paraglide/messages";

interface PostLockProps {
  slug: string;
}

export function PostLock({ slug }: PostLockProps) {
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!password || pending) return;

    setPending(true);
    setFailed(false);
    try {
      const response = await fetch("/api/post-unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, password }),
      });
      if (!response.ok) {
        setFailed(true);
        return;
      }
      setPassword("");
      await queryClient.invalidateQueries({
        queryKey: orpc.posts.bySlug.key({ input: { slug } }),
      });
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center fuwari-onload-animation">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/5 fuwari-text-50 dark:bg-white/10">
        <Lock size={22} strokeWidth={1.5} />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold fuwari-text-90">
          {m.post_locked_title()}
        </h2>
        <p className="text-sm fuwari-text-50">{m.post_locked_desc()}</p>
      </div>
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-2"
      >
        <PasswordInput
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={m.post_locked_placeholder()}
          autoFocus
          secret
        />
        <Button
          type="submit"
          variant="primary"
          loading={pending}
          disabled={pending || password.length === 0}
        >
          {pending ? m.post_locked_submitting() : m.post_locked_submit()}
        </Button>
        {failed && (
          <p className="text-sm text-(--fuwari-danger-fg)">
            {m.post_locked_error()}
          </p>
        )}
      </form>
    </div>
  );
}
