<?php

namespace WorldView\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Cache\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

class RateLimitMiddleware
{
    protected RateLimiter $limiter;

    public function __construct(RateLimiter $limiter)
    {
        $this->limiter = $limiter;
    }

    public function handle(Request $request, Closure $next, int $maxAttempts = 30): Response
    {
        $key = 'worldview:' . $request->ip();

        if ($this->limiter->tooManyAttempts($key, $maxAttempts)) {
            return response()->json(['error' => 'Too many requests, please try again later.'], 429);
        }

        $this->limiter->hit($key, 60);

        $response = $next($request);

        return $response;
    }
}
