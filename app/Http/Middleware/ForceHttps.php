<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ForceHttps
{
    public function handle(Request $request, Closure $next): Response
    {
        $proto = $request->header('X-Forwarded-Proto') ?? $request->header('X-Forwarded-Protocol');
        if (app()->environment('production') && $proto === 'http' && $request->path() !== 'up') {
            return redirect()->secure($request->getRequestUri(), 301);
        }

        return $next($request);
    }
}
