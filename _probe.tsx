import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "./src/components/Markdown.tsx";
for (const s of ["- Fixed the bug", "- **Auth**\n- token refresh", "Plain text only"]) {
  console.log(JSON.stringify(s), "=>", renderToStaticMarkup(React.createElement(Markdown, { children: s })));
}
