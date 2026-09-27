<?php

declare(strict_types=1);

namespace App\Contexts\DocumentManagement\Infrastructure\Services;

use setasign\Fpdi\Fpdi;

class WatermarkFpdi extends Fpdi
{
    /** @var array<int, array{parms: array{ca: float, CA: float, BM: string}, n: int}> */
    protected array $extGStates = [];

    protected float $rotationAngle = 0.0;

    /**
     * Set alpha transparency for stroking and non-stroking operations.
     */
    public function setAlpha(float $alpha, string $bm = 'Normal'): void
    {
        $alpha = max(0.0, min(1.0, $alpha));
        $gs = $this->addExtGState([
            'ca' => $alpha,
            'CA' => $alpha,
            'BM' => '/' . $bm,
        ]);
        $this->setExtGState($gs);
    }

    /**
     * @param array{ca: float, CA: float, BM: string} $parms
     */
    public function addExtGState(array $parms): int
    {
        $n = count($this->extGStates) + 1;
        $this->extGStates[$n] = [
            'parms' => $parms,
            'n' => 0,
        ];

        return $n;
    }

    public function setExtGState(int $gs): void
    {
        $this->_out(sprintf('/GS%d gs', $gs));
    }

    /**
     * Rotate coordinate system around point ($x, $y).
     */
    public function rotate(float $angle, float $x = -1, float $y = -1): void
    {
        if ($x < 0) {
            $x = $this->x;
        }
        if ($y < 0) {
            $y = $this->y;
        }

        if ($this->rotationAngle !== 0.0) {
            $this->_out('Q');
        }

        $this->rotationAngle = $angle;

        if ($angle !== 0.0) {
            $angleRad = $angle * M_PI / 180;
            $c = cos($angleRad);
            $s = sin($angleRad);
            $cx = $x * $this->k;
            $cy = ($this->h - $y) * $this->k;
            $this->_out(sprintf(
                'q %.5F %.5F %.5F %.5F %.2F %.2F cm 1 0 0 1 %.2F %.2F cm',
                $c,
                $s,
                -$s,
                $c,
                $cx,
                $cy,
                -$cx,
                -$cy
            ));
        }
    }

    /**
     * Terminate the active coordinate rotation/transformation.
     */
    public function stopTransform(): void
    {
        if ($this->rotationAngle !== 0.0) {
            $this->rotationAngle = 0.0;
            $this->_out('Q');
        }
    }

    protected function _endpage(): void
    {
        $this->stopTransform();
        parent::_endpage();
    }

    protected function _putresources(): void
    {
        $this->_putextgstates();
        parent::_putresources();
    }

    protected function _putextgstates(): void
    {
        for ($i = 1; $i <= count($this->extGStates); $i++) {
            $this->_newobj();
            $this->extGStates[$i]['n'] = $this->n;
            $this->_put('<</Type /ExtGState');
            $parms = $this->extGStates[$i]['parms'];
            $this->_put(sprintf('/ca %.3F', $parms['ca']));
            $this->_put(sprintf('/CA %.3F', $parms['CA']));
            $this->_put('/BM ' . $parms['BM']);
            $this->_put('>>');
            $this->_put('endobj');
        }
    }

    protected function _putresourcedict(): void
    {
        parent::_putresourcedict();

        if (!empty($this->extGStates)) {
            $this->_put('/ExtGState <<');
            foreach ($this->extGStates as $k => $extGState) {
                $this->_put('/GS' . $k . ' ' . $extGState['n'] . ' 0 R');
            }
            $this->_put('>>');
        }
    }
}
