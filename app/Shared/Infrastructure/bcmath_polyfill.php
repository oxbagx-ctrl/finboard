<?php

declare(strict_types=1);

if (!extension_loaded('bcmath')) {
    if (!function_exists('bcadd')) {
        function bcadd(string $num1, string $num2, ?int $scale = null): string
        {
            $scale = $scale ?? 0;
            $res = (float) $num1 + (float) $num2;

            return sprintf("%.{$scale}f", $res);
        }
    }

    if (!function_exists('bcsub')) {
        function bcsub(string $num1, string $num2, ?int $scale = null): string
        {
            $scale = $scale ?? 0;
            $res = (float) $num1 - (float) $num2;

            return sprintf("%.{$scale}f", $res);
        }
    }

    if (!function_exists('bcmul')) {
        function bcmul(string $num1, string $num2, ?int $scale = null): string
        {
            $scale = $scale ?? 0;
            $res = (float) $num1 * (float) $num2;

            return sprintf("%.{$scale}f", $res);
        }
    }

    if (!function_exists('bcdiv')) {
        function bcdiv(string $num1, string $num2, ?int $scale = null): string
        {
            $scale = $scale ?? 0;
            if ((float) $num2 == 0.0) {
                throw new DivisionByZeroError('Division by zero in bcdiv polyfill.');
            }
            $res = (float) $num1 / (float) $num2;

            return sprintf("%.{$scale}f", $res);
        }
    }

    if (!function_exists('bccomp')) {
        function bccomp(string $num1, string $num2, ?int $scale = null): int
        {
            $n1 = (float) $num1;
            $n2 = (float) $num2;
            $diff = $n1 - $n2;
            $epsilon = $scale !== null && $scale > 0 ? pow(10, -$scale) : 0.00000001;

            if (abs($diff) < $epsilon) {
                return 0;
            }

            return $diff > 0 ? 1 : -1;
        }
    }
}
