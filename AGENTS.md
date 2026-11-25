<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Asset and PM navigation share a building/system/equipment tree using existing imported parent references; PM branches include expandable task leaves that select individual schedules in place, while assets open equipment details. Render closed branches lazily and paginate open lists to avoid large-page freezes.
- Assets and PM Schedule initially fetch only navigation labels and hierarchy; defer detail queries and right-hand lists until an explicit building, system, equipment, or task selection, and scope detail reads to that selection.
