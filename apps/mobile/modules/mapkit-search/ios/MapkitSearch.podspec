Pod::Spec.new do |s|
  s.name           = 'MapkitSearch'
  s.version        = '1.0.0'
  s.summary        = 'MKLocalSearch for Split the Wine venue typeahead'
  s.description    = 'On-device Apple MapKit place search for iOS hosts'
  s.license        = 'MIT'
  s.author         = 'Split the Wine'
  s.homepage       = 'https://splitthewine.app'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { :git => 'https://github.com/placeholder/mapkit-search.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'MapKit', 'CoreLocation'
  s.source_files = 'MapkitSearchModule.swift'
end
