import cac from "cac";
import "bun";

function setupCLI(customArgs: string[] | null = null) {
  console.log("start")
  const cli = cac("teste");

  cli.command("setup <dir>", "Create base project configuration")
    .option('-r, --recursive', 'Remove recursively')
    .action((dir, options)=> {
      console.log(dir, options)
    })
  cli.help()

  const argsParaOParser = customArgs 
  ? ["", "", ...customArgs] 
  : process.argv;
  console.log(argsParaOParser)
  cli.parse(argsParaOParser)
  console.log("stop")
}

setupCLI(["setup", "teste", "--recursive"])