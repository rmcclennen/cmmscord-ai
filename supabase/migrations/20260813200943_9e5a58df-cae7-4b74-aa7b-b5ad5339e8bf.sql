-- Restrict bid visibility to people involved in the request or approvers
DROP POLICY IF EXISTS "Authenticated can view bids" ON public.part_request_bids;

CREATE POLICY "Involved users and approvers view bids"
ON public.part_request_bids
FOR SELECT
TO authenticated
USING (
  public.can_approve_deletions(auth.uid())
  OR auth.uid() = created_by
  OR EXISTS (
    SELECT 1 FROM public.part_requests pr
    WHERE pr.id = part_request_bids.request_id
      AND (pr.requested_by = auth.uid() OR pr.sent_to = auth.uid() OR pr.handled_by = auth.uid())
  )
);

-- Team directory readable only by users who are themselves in the directory
DROP POLICY IF EXISTS "Signed-in users view team directory" ON public.team_directory;

CREATE POLICY "Team members view team directory"
ON public.team_directory
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR EXISTS (SELECT 1 FROM public.team_directory me WHERE me.id = auth.uid())
);