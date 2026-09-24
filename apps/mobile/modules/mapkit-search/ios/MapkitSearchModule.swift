import ExpoModulesCore
import MapKit
import CoreLocation

public class MapkitSearchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MapkitSearch")

    AsyncFunction("suggest") { (query: String, lat: Double?, lng: Double?) -> [[String: Any?]] in
      let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
      guard trimmed.count >= 2 else { return [] }

      let request = MKLocalSearch.Request()
      request.naturalLanguageQuery = trimmed
      request.resultTypes = [.pointOfInterest]
      request.pointOfInterestFilter = MKPointOfInterestFilter(including: [
        .restaurant,
        .cafe,
        .bakery,
        .brewery,
        .winery,
        .nightlife,
      ])
      if let lat, let lng {
        let center = CLLocationCoordinate2D(latitude: lat, longitude: lng)
        request.region = MKCoordinateRegion(
          center: center,
          latitudinalMeters: 8_000,
          longitudinalMeters: 8_000
        )
      }

      let search = MKLocalSearch(request: request)
      let response = try await search.start()

      return response.mapItems.prefix(8).map { item -> [String: Any?] in
        let coord = item.placemark.coordinate
        let address = [
          item.placemark.thoroughfare,
          item.placemark.locality,
          item.placemark.administrativeArea,
        ]
        .compactMap { $0 }
        .joined(separator: ", ")

        let name = item.name ?? trimmed
        let placeId = String(
          format: "apple:%.5f,%.5f:%@",
          coord.latitude,
          coord.longitude,
          name
        )

        return [
          "placeId": placeId,
          "name": name,
          "secondary": address,
          "lat": coord.latitude,
          "lng": coord.longitude,
          "formattedAddress": address,
          "category": item.pointOfInterestCategory?.rawValue,
        ]
      }
    }
  }
}
