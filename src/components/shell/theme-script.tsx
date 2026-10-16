export function ThemeScript() {
  const code = `(function(){try{var stored=localStorage.getItem("theme");var dark=stored?stored==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",dark);}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
