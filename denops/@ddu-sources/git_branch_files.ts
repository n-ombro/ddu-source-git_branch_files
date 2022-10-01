import {
  BaseSource,
  Context,
  Item,
} from "https://deno.land/x/ddu_vim@v0.5.0/types.ts";
import { Denops, fn } from "https://deno.land/x/ddu_vim@v0.5.0/deps.ts";
import { ActionData } from "https://deno.land/x/ddu_kind_file@v0.3.0/file.ts";
import { relative } from "https://deno.land/std@0.147.0/path/mod.ts";

type Params = Record<never, never>;

export class Source extends BaseSource<Params> {
  kind = "file";

  gather(args: {
    denops: Denops;
    context: Context;
    sourceParams: Params;
  }): ReadableStream<Item<ActionData>[]> {
    return new ReadableStream({
      async start(controller) {
        const current = new TextDecoder().decode(
          (await Deno.spawn("git", { args: ["rev-parse", "--abbrev-ref", "HEAD"] })).stdout
        )
        const root = new TextDecoder().decode(
          (await Deno.spawn("git", { args: ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"] })).stdout
        )
        const root_commit = new TextDecoder().decode(
          (await Deno.spawn("git", { args: ["show-branch", "--sha1-name", `${ current.trim() }`, `${ root.trim() }`] })).stdout
        ).
          trim().
          split(/\r?\n/).
          pop().
          match(/^.*?\[(.*?)\]/)[1]
        const git_dir = new TextDecoder().decode(
          (await Deno.spawn("git", { args: ["rev-parse", "--show-toplevel"] })).stdout
        ).trim()
        const branch_files = new TextDecoder().decode(
          (await Deno.spawn("git", { args: ["diff", "--name-only", `${ root_commit }`, `--line-prefix=${ git_dir }/`] })).stdout
        ).split(/\r?\n/)
        const untracked = new TextDecoder().decode(
          (await Deno.spawn("git", { args: ["ls-files", "--others", "--exclude-standard"] })).stdout
        ).split(/\r?\n/)

        const paths = branch_files.concat(untracked)

        const cwd = await fn.getcwd(args.denops) as string

        const items: Item<ActionData>[] = [];
        for (const path of paths) {
            items.push({
              word: relative(cwd, path),
              action: {
                path: relative(cwd, path),
              },
            })
        }
        controller.enqueue(items);
        controller.close();
      },
    });
  }

  params(): Params {
    return {};
  }
}
