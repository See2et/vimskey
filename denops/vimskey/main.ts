import { Denops, helper } from "./deps.ts";
import { auth, dps } from "./deps.ts";
import { open } from "./deps.ts";
import { zod } from "./deps.ts";
import { unknownutil } from "./deps.ts";
import { connectTimeline, sendNoteReq } from "./libs/misskey.ts";
import { getVimValue } from "./libs/denops.ts";

export async function main(denops: Denops): Promise<void> {
  denops.dispatcher = {
    async openTimeline(timelineType: unknown): Promise<void> {
      const Timeline = zod.enum(["hybrid", "home", "local", "global"]);
      const validatedTimelineType = (() => {
        try {
          return Timeline.parse(
            unknownutil.ensureString(timelineType),
          );
        } catch (_e) {
          helper.echoerr(
            denops,
            "Invalid TimelineType. Vimskey will open local Timeline.",
          );
        }
      })();

      const token = await getVimValue(denops, { type: "g", name: "token" });
      // const token = await system.readConfig()
      if (token === null) {
        await denops.dispatcher.getToken();
        await denops.dispatcher.openTimeline(validatedTimelineType);
        return;
      }
      const instanceUri = await getVimValue(denops, {
        type: "g",
        name: "instance#origin",
      }) as string;

      if (token) {
        await connectTimeline(
          denops,
          instanceUri,
          token,
          validatedTimelineType,
        );
      }
    },

    async getToken() {
      if (await getVimValue(denops, { type: "g", name: "token" })) {
        return console.log("Already authed.");
      }

      const origin = await dps.saveInput(denops, {
        type: "g",
        name: "instance#origin",
        prompt: "InstanceUrl: ",
        text: "https://",
      });
      const miauth = auth.useMiauth(origin);

      await open(miauth.authUrl());
      await dps.waitPressEnter(
        denops,
        "After authentication is complete, press enter...",
      );

      await dps.setVimValue(denops, {
        type: "g",
        name: "token",
        value: await miauth.getToken(),
      });
    },

    async sendNote() {
      const token = await getVimValue(denops, { type: "g", name: "token" });
      // const token = await system.readConfig()
      if (token === null) {
        await denops.dispatcher.getToken();
        return await denops.dispatcher.sendNote();
      }

      const noteBody = await helper.input(denops, {
        prompt: "What you want to say? ",
      });

      if (noteBody) {
        return await sendNoteReq(denops, { body: noteBody });
      } else if (noteBody == null) {
        return null;
        // throw new Error(`noteBody: ${noteBody}`)
        // throw new Error("[User input]Note body is empty");
      }
    },
  };

  await denops.cmd(
    `command! -nargs=0 VimskeyAuth call denops#request('${denops.name}', 'getToken', [])`,
  );

  await denops.cmd(
    `
      function! VimskeyTimelineTypeCompletion(ArgLead, CmdLine, CursorPos)
        let l:filter_cmd = printf('v:val =~ "^%s"', a:ArgLead)
        return filter(['global', 'hybrid', 'local', 'home'], l:filter_cmd)
      endfunction
    `,
  );

  await denops.cmd(
    `command! -nargs=0 VimskeyNote call denops#request('${denops.name}', 'sendNote', [])`,
  );
  //
  // await denops.cmd(
  //   `command! -nargs=0 VimskeyNotification call denops#request('${denops.name}', 'openNotification', [])`,
  // );
  //
  await denops.cmd(
    `command! -nargs=1 -complete=customlist,VimskeyTimelineTypeCompletion VimskeyOpenTL call denops#request('${denops.name}', 'openTimeline', ['<args>'])`,
  );
  //
  // await denops.cmd(
  //   `command! -nargs=+ VimskeyNoteFromCmdline call denops#request('${denops.name}', 'sendNote', [<args>])`,
  // );
}
