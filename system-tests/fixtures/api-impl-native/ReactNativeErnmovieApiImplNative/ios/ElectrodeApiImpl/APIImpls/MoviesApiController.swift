/*
 * Copyright 2017 WalmartLabs
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import Foundation

/**
 * GENERATED CODE: DO NOT MODIFY
 * Do not modify the content of this class as it will be regenerated every time an api-impl-regen command is executed.
 * @see <a href:"https://electrode.gitbooks.io/electrode-native/content/v/master/cli/regen-api-impl.html"></a>
 */
@objc public final class MoviesApiController: NSObject
{
    // Singleton
    static let instance = MoviesApiController()
    private override init() {}
    
    private var requestHandler: MoviesApiRequestHandlerProvider?
    
    public func register(config: MoviesApiConfig? = nil)
    {
        // Only register once.
        guard self.requestHandler == nil else
        {
            return
        }

        self.requestHandler = MoviesApiRequestHandlerProvider(handlerConfig: config)
        self.requestHandler?.registerGetTopRatedMoviesRequestHandler()
        self.requestHandler?.registerGetMovieDetailRequestHandler()
    }
}
