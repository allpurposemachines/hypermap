import lume from "lume/mod.ts";
import tailwindcss from "lume/plugins/tailwindcss.ts";
import postcss from "lume/plugins/postcss.ts";
import typography from "npm:@tailwindcss/typography";

const site = lume();

site.use(tailwindcss(
	{
		options: {
			plugins: [typography]
		}
	}
));
site.use(postcss());

export default site;
