import lume from "lume/mod.ts";
import nunjucks from "lume/plugins/nunjucks.ts";

const site = lume();

site.use(nunjucks());

site.add("styles.css");

site.addEventListener("afterBuild", async () => {
  await Deno.copyFile("../spec/index.html", "./_site/spec/raw.html");
  await Deno.copyFile("../explorer/index.html", "./_site/explorer/raw.html");
});

export default site;
