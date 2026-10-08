# Kakao Delivery Map

## Server Setup

Register the Kakao JavaScript and REST API keys in the server `.env`:

```dotenv
KAKAO_MAPS_JAVASCRIPT_KEY=your-javascript-key
KAKAO_REST_API_KEY=your-rest-api-key
# Optional if Kakao Mobility uses a separate application
KAKAO_DIRECTIONS_REST_API_KEY=your-mobility-rest-api-key
```

Enable Kakao Map/Local API access in Kakao Developers and driving directions
in Kakao Mobility Developers. Register the domains that serve the map page,
including `https://app.bebeu.cloud` and the development server domain if used.
Restart the server after changing environment variables.

The map is hosted at `/delivery-map.html` on the configured server and embedded
in the web/native app. This keeps map authentication on the registered server
domain instead of Android WebView's `https://localhost` origin. The JavaScript
key is a public, domain-restricted SDK key; the REST keys are server-only and
are not returned in bootstrap data or embedded in Android assets.

## Route Planning

- Initial map center: the Bebeu office. The first delivery-account position pans
  to that user's location. Subsequent updates move the marker without interrupting
  manual map interaction. Administrators can see the latest driver position live.
- Origin: selected/current device location if available, otherwise the office.
  Final destination: the office.
- Search uses Kakao address and place APIs, with Gwangju as the default region.
  Administrative district and neighborhood come from resolved coordinates.
- Complete one district, then move to the next. Keep each neighborhood contiguous.
- Start with the outlying district, then prefer the fastest transition to the
  next district. The first departure distance does not dominate delivery order.
- Use a directed driving-time matrix, not straight-line distances, to compare
  stops. Near destinations use batch requests; longer legs use individual
  requests. Directional costs preserve one-way street and traffic effects.
- For up to nine stops in a neighborhood, dynamic programming compares every
  ordering, including entry and the onward exit. Larger neighborhoods compare
  multiple entry points and improve their order through local relocation.
- These are constrained route-planning heuristics, not a guarantee of the
  globally shortest tour. Times depend on the traffic information at calculation.
- The returned map lines are actual driving-route geometry. Failed searches or
  missing driving data stop calculation; no delivery address is silently omitted.
- Dragging retains the user's order and recalculates driving geometry.

## Delivery Session (Android 1.14)

- After planning, delivery accounts can start a session from the map's top left.
- Previous, next and end are available both on the map and in an ongoing Android
  notification. Selecting a stop does not change its database completion status.
- Starting requires location and notification permissions and explicit consent
  for position sharing while the screen is off or another app is foregrounded.
- A location foreground service posts positions to the existing delivery-location
  endpoint. Ending, logging out or removing the app task stops this service.
- Web sessions support map controls and foreground location sharing, but not the
  persistent Android notification. Existing Android installations must update.
- `public/app-release.json` remains the published Play version until the new AAB
  is actually published; the direct-download page can offer the new APK earlier.
- Before Play publication, update foreground-service location declarations and
  verify notification controls and screen-off tracking on a physical device.

## References

- https://apis.map.kakao.com/web/guide/
- https://developers.kakao.com/docs/ko/local/dev-guide
- https://developers.kakaomobility.com/guide/navi-api/directions.html
- https://developers.kakaomobility.com/guide/navi-api/destinations.html
