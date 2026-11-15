import fs from "node:fs/promises";
import path from "node:path";

export default function (eleventyConfig) {
	eleventyConfig.addPassthroughCopy("styles.css");
	eleventyConfig.addPassthroughCopy("favicon.svg");
	eleventyConfig.addPassthroughCopy("og-image.png");
	eleventyConfig.addPassthroughCopy("js");
	eleventyConfig.addPassthroughCopy({
		"node_modules/three/build/three.module.min.js": "vendor/three/three.module.min.js",
		"node_modules/three/examples/jsm/lines": "vendor/three/lines",
	});

	eleventyConfig.ignores.add("README.md");
	eleventyConfig.ignores.add("LICENSE");

	eleventyConfig.on("eleventy.after", async ({ dir }) => {
		const out = dir.output;
		await fs.mkdir(path.join(out, "spec"), { recursive: true });
		await fs.mkdir(path.join(out, "explorer"), { recursive: true });
		await fs.copyFile("../spec/index.html", path.join(out, "spec/raw.html"));
		await fs.copyFile("../explorer/index.html", path.join(out, "explorer/raw.html"));
	});

	return {
		dir: {
			input: ".",
			output: "_site",
			includes: "_includes",
		},
		markdownTemplateEngine: "njk",
		htmlTemplateEngine: "njk",
	};
}
